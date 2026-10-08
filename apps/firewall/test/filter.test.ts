// PHX-3/4: selection is not transaction authorisation or upstream forwarding.
import {strict as assert} from "node:assert";
import {test} from "node:test";
const module=await import("../src/filter.ts").catch(()=>null);
function api(){assert.ok(module,"MCP filter must exist");return module;}
const config={cluster:"devnet",tools:["send_solana_transaction","transfer_tokens"]};
const call=(name:string,arguments_:unknown={networkId:"solana:devnet"})=>JSON.stringify({name,arguments:arguments_});
const refused=(work:()=>unknown,reason:string)=>assert.throws(work,{name:"McpFilterError",code:"mcp-filter",reason});
test("PHX-3: only explicitly configured supported tools are selectable",()=>{
  const filter=api().createToolFilter(config);assert.deepEqual(filter.tools,config.tools);
  for(const name of config.tools){const selected=filter.select(call(name));assert.equal(selected.kind,"filtered-tool-call");assert.equal(selected.name,name);assert.deepEqual(selected.arguments,{networkId:"solana:devnet"});}
  const only=api().createToolFilter({...config,tools:["send_solana_transaction"]});refused(()=>only.select(call("transfer_tokens")),"tool");
  const empty=api().createToolFilter({...config,tools:[]});for(const name of config.tools)refused(()=>empty.select(call(name)),"tool");
  for(const name of ["sign_solana_message","get_wallet_addresses","get_token_balances","simulate_transaction","buy_token","portfolio_rebalance","pay_api_access","unknown",""]){refused(()=>filter.select(call(name)),"tool");}
});
test("PHX-4: explicit devnet is required, including for simulation and both tools",()=>{
  const filter=api().createToolFilter(config);
  for(const name of config.tools)for(const networkId of [undefined,null,"solana:mainnet","solana:testnet","devnet","SOLANA:DEVNET",1,{},["solana:devnet"]]){
    refused(()=>filter.select(call(name,{...(networkId===undefined?{}:{networkId}),confirmed:false})),"network");
  }
});
test("PHX-3/4: configuration is copied, immutable and refuses unsupported policy input",()=>{
  const source={...config,tools:[...config.tools]},filter=api().createToolFilter(source);source.tools.length=0;source.cluster="mainnet";
  assert.deepEqual(filter.tools,config.tools);assert.ok(Object.isFrozen(filter));assert.ok(Object.isFrozen(filter.tools));assert.throws(()=>(filter.tools as string[]).push("sign_solana_message"));
  for(const input of [null,[],{}, {...config,cluster:"mainnet"},{...config,cluster:"solana:devnet"},{...config,extra:true},{...config,tools:["sign_solana_message"]},{...config,tools:["send_solana_transaction","send_solana_transaction"]},{...config,tools:"send_solana_transaction"},{...config,tools:new Array(1)}])refused(()=>api().createToolFilter(input),"configuration");
});
test("PHX-3: malformed envelopes refuse with fixed redacted errors",()=>{
  const filter=api().createToolFilter(config),sentinel="fixture-redaction-sentinel";
  for(const input of [null,{},"",sentinel,"null","[]","1",JSON.stringify({name:"send_solana_transaction"}),call("send_solana_transaction",null),call("send_solana_transaction",[]),JSON.stringify({name:"send_solana_transaction",arguments:{networkId:"solana:devnet"},extra:sentinel})]){
    try{filter.select(input);assert.fail("malformed call accepted");}catch(error){assert.equal((error as Error).name,"McpFilterError");assert.equal(Reflect.get(error as object,"reason"),"request");assert.equal((error as Error).message.includes(sentinel),false);}
  }
});
test("PHX-3: selected arguments are detached and deeply frozen without losing transaction fields",()=>{
  const filter=api().createToolFilter(config),input={networkId:"solana:devnet",transaction:"AQID",confirmed:true,nested:{amounts:["100",{mint:"public-fixture"}]}};
  const selected=filter.select(call("send_solana_transaction",input));input.nested.amounts.length=0;assert.equal(selected.arguments.transaction,"AQID");assert.equal(selected.arguments.confirmed,true);
  assert.ok(Object.isFrozen(selected));assert.ok(Object.isFrozen(selected.arguments));assert.ok(Object.isFrozen(selected.arguments.nested));assert.ok(Object.isFrozen((selected.arguments.nested as {amounts:unknown[]}).amounts));
  assert.deepEqual(selected.arguments.nested,{amounts:["100",{mint:"public-fixture"}]});
});
test("PHX-3: byte and nesting limits reject resource abuse at their declared boundaries",()=>{
  const filter=api().createToolFilter(config),prefix=call("send_solana_transaction",{networkId:"solana:devnet",padding:""}),room=65536-Buffer.byteLength(prefix);
  assert.equal(Buffer.byteLength(call("send_solana_transaction",{networkId:"solana:devnet",padding:"x".repeat(room)})),65536);
  assert.doesNotThrow(()=>filter.select(call("send_solana_transaction",{networkId:"solana:devnet",padding:"x".repeat(room)})));
  refused(()=>filter.select(call("send_solana_transaction",{networkId:"solana:devnet",padding:"é".repeat(room)})),"request");
  refused(()=>filter.select(call("send_solana_transaction",{networkId:"solana:devnet",padding:"x".repeat(room+1)})),"request");
  let nested:unknown=0;for(let i=0;i<40;i++)nested={nested};refused(()=>filter.select(call("send_solana_transaction",{networkId:"solana:devnet",nested})),"request");
});
test("PHX-3: accessors, symbols and hostile configuration cannot install unlisted tools or leak errors",()=>{
  let reads=0;const tools=["send_solana_transaction"];
  Object.defineProperty(tools,"0",{get(){reads++;return reads<3?"send_solana_transaction":"sign_solana_message";},enumerable:true});
  refused(()=>api().createToolFilter({...config,tools}),"configuration");assert.equal(reads,0,"configuration accessors must not execute");
  const previous=Object.getOwnPropertyDescriptor(Object.prototype,"value");
  try{Object.defineProperty(Object.prototype,"value",{value:"send_solana_transaction",configurable:true});refused(()=>api().createToolFilter({...config,tools}),"configuration");assert.equal(reads,0);}
  finally{if(previous)Object.defineProperty(Object.prototype,"value",previous);else Reflect.deleteProperty(Object.prototype,"value");}
  const source={...config};Object.defineProperty(source,"tools",{get(){throw new Error("fixture-config-secret");},enumerable:true});refused(()=>api().createToolFilter(source),"configuration");
  refused(()=>api().createToolFilter({...config,[Symbol("hidden")]:true}),"configuration");
  const hostile=new Proxy({...config},{getPrototypeOf(){throw new Error("fixture-config-secret");}});
  try{api().createToolFilter(hostile);assert.fail("hostile config accepted");}catch(error){assert.equal((error as Error).name,"McpFilterError");assert.equal((error as Error).message.includes("fixture-config-secret"),false);}
});
test("PHX-4: an inherited network cannot supply the omitted mainnet default",()=>{
  const filter=api().createToolFilter(config),previous=Object.getOwnPropertyDescriptor(Object.prototype,"networkId");
  try{Object.defineProperty(Object.prototype,"networkId",{value:"solana:devnet",configurable:true});refused(()=>filter.select(call("send_solana_transaction",{})),"network");}
  finally{if(previous)Object.defineProperty(Object.prototype,"networkId",previous);else Reflect.deleteProperty(Object.prototype,"networkId");}
});
test("PHX-3: proxy reads cannot substitute a tool after configuration validation",()=>{
  let reads=0;const tools=new Proxy(["send_solana_transaction"],{get(target,key,receiver){if(key==="0")return ++reads<3?"send_solana_transaction":"sign_solana_message";return Reflect.get(target,key,receiver);}});
  const filter=api().createToolFilter({...config,tools});assert.deepEqual(filter.tools,["send_solana_transaction"]);assert.equal(reads,0,"capture data descriptors without invoking proxy value reads");
  refused(()=>filter.select(call("sign_solana_message")),"tool");
});
