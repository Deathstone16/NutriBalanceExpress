import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseEnv} from 'node:util';
import {setTimeout as wait} from 'node:timers/promises';
import {createConnection} from 'node:net';

const args=process.argv.slice(2);
const configIndex=args.indexOf('--config');
if(configIndex<0||!args[configIndex+1])throw new Error('Indicá --config con el archivo privado de esta PC.');
const config=JSON.parse(fs.readFileSync(path.resolve(args[configIndex+1]),'utf8'));
const root=path.resolve(config.root),workspace=path.resolve(config.workspace);
function under(base,...parts){
  const result=path.resolve(base,...parts);
  if(result.toLowerCase()!==base.toLowerCase()&&!result.toLowerCase().startsWith(base.toLowerCase()+path.sep))throw new Error('Ruta fuera del directorio autorizado.');
  return result;
}
under(workspace,root);
for(const file of [config.backendEnv,config.frontendEnv,config.postgresData,config.postmanCollection,config.apiTunnelState])under(workspace,file);
for(const component of ['frontend','backend']){
  if(!/^[\w.-]+\/[\w.-]+$/.test(config.repositories[component]))throw new Error('Repositorio inválido.');
}
const publicOrigin=new URL(config.publicOrigin);
if(publicOrigin.protocol!=='https:'||publicOrigin.origin!==config.publicOrigin)throw new Error('Origen público inválido.');
fs.mkdirSync(root,{recursive:true});
const stateFile=under(root,'state.json'),lockFile=under(root,'agent.lock'),stopFile=under(root,'agent.stop');
const readJson=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
function writeJson(file,value){const temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2));fs.renameSync(temporary,file)}
if(args.includes('--status')){console.log(JSON.stringify(readJson(stateFile,{}),null,2));process.exit(0)}
if(args.includes('--stop')){fs.writeFileSync(stopFile,'stop');console.log('Se solicitó detener el agente; la aplicación sigue activa.');process.exit(0)}
if(fs.existsSync(lockFile)){
  const old=readJson(lockFile,{});let alive=false;
  try{process.kill(old.pid,0);alive=true}catch{}
  if(alive){console.log('El agente ya está ejecutándose.');process.exit(0)}
  fs.unlinkSync(lockFile);
}
fs.writeFileSync(lockFile,JSON.stringify({pid:process.pid}),{flag:'wx'});
if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);
const state=readJson(stateFile,{live:config.initial,repositories:{},attempts:{}});
state.repositories??={};state.attempts??={};state.agentPid=process.pid;
if(args.includes('--retry'))state.attempts={};
let running=true;
process.on('SIGTERM',()=>{running=false});process.on('SIGINT',()=>{running=false});
const log=message=>console.log(`${new Date().toISOString()} ${message}`);
function save(){state.checkedAt=new Date().toISOString();writeJson(stateFile,state)}
async function run(command,arguments_,{cwd=workspace,env=process.env,input,outputFile,capture=false,timeoutMs=1200000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,arguments_,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',finished=false;
    const file=outputFile?fs.openSync(outputFile,'a'):null;
    child.stdout.on('data',chunk=>{if(capture)stdout+=chunk;if(file!==null)fs.writeSync(file,chunk)});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);if(file!==null)fs.writeSync(file,chunk)});
    const timer=setTimeout(()=>child.kill(),timeoutMs);
    function finish(error){if(finished)return;finished=true;clearTimeout(timer);if(file!==null)fs.closeSync(file);if(error)reject(error);else resolve(stdout)}
    child.on('error',finish);
    child.on('close',code=>finish(code===0?null:new Error(`${path.basename(command)} terminó con código ${code}. ${capture?stderr:'Ver registro local del despliegue.'}`)));
    child.stdin.end(input);
  });
}
async function github(endpoint,body){
  const arguments_=['api',endpoint,'-H','Accept: application/vnd.github+json'];
  if(body)arguments_.push('--method','POST','--input','-');
  return JSON.parse(await run(config.gh,arguments_,{capture:true,input:body?JSON.stringify(body):undefined,timeoutMs:30000}));
}
async function healthy(url){try{const response=await fetch(url,{signal:AbortSignal.timeout(2500)});return response.ok&&(await response.json()).status==='ok'}catch{return false}}
async function portOpen(port){return new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});const done=value=>{socket.destroy();resolve(value)};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1000,()=>done(false))})}
async function waitHealthy(url){for(let count=0;count<120;count++){if(await healthy(url))return;await wait(500)}throw new Error(`El servicio no respondió: ${url}`)}
function frontendEnvironment(){
  return {...process.env,...parseEnv(fs.readFileSync(config.frontendEnv,'utf8')),NODE_ENV:'production',PUBLIC_SITE_ORIGIN:config.publicOrigin,EXPRESS_ALLOWED_ORIGIN:config.publicOrigin,EXPRESS_LOCAL_API_ORIGIN:'http://127.0.0.1:3001',NUTRI_BACKEND_DIR:state.live.backend.dir,SITES_PNPM_SHARED_STORE:under(root,'pnpm-store')};
}
async function startLive(){
  if(await healthy('http://127.0.0.1:3000/api/health')&&await healthy('http://127.0.0.1:3001/health'))return;
  const dir=state.live.frontend.dir;
  const out=fs.openSync(under(root,'app-out.log'),'a'),err=fs.openSync(under(root,'app-error.log'),'a');
  const child=spawn(config.node,['--env-file-if-exists=.env.local','scripts/serve-expo.mjs','--sin-compilar'],{cwd:dir,env:frontendEnvironment(),detached:true,windowsHide:true,stdio:['ignore',out,err]});
  child.unref();fs.closeSync(out);fs.closeSync(err);
  await waitHealthy('http://127.0.0.1:3000/api/health');await waitHealthy('http://127.0.0.1:3001/health');
  const localPage=await fetch('http://127.0.0.1:3000/',{signal:AbortSignal.timeout(5000)});
  if(!localPage.ok||!localPage.headers.get('content-type')?.includes('text/html'))throw new Error('El frontend local no entregó HTML.');
  const response=await fetch(config.publicOrigin,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  const html=response.headers.get('content-type')?.includes('text/html');
  if(response.ok&&html){state.publicEndpoint={status:response.status,access:'public'};return}
  if(response.status===403&&response.headers.get('server')==='cloudflare'&&html&&/<title>[^<]*Cloudflare Access<\/title>/i.test(await response.text())){
    state.publicEndpoint={status:403,access:'cloudflare-access',externalApplicationVerified:false};
    log('Servicios locales comprobados. Cloudflare Access protege el dominio; la comprobación desde Vercel requiere su Service Token.');
    return;
  }
  throw new Error('La web pública no respondió correctamente.');
}
async function stopLive(){
  const runtime=path.join(state.live.frontend.dir,'.sites-runtime/expo');
  const previous=readJson(path.join(runtime,'state.json'),{});
  if(previous.pid)fs.writeFileSync(path.join(runtime,'stop'),'detener');
  for(let count=0;count<90;count++){
    let alive=false;if(previous.pid){try{process.kill(previous.pid,0);alive=true}catch{}}
    if(!alive&&!await portOpen(3000)&&!await portOpen(3001))return;await wait(500);
  }
  throw new Error('Los servicios anteriores no se cerraron; no se inicia otra copia.');
}
async function ensureApiTunnel(){
  let current=readJson(config.apiTunnelState,{}),alive=false;
  if(current.pid){try{process.kill(current.pid,0);alive=await portOpen(20242)}catch{}}
  if(alive&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(current.url)){state.apiUrl=current.url;return}
  const output=under(root,'api-tunnel-out.log'),error=under(root,'api-tunnel-error.log');
  const out=fs.openSync(output,'w'),err=fs.openSync(error,'w');
  const child=spawn(config.cloudflared,['tunnel','--url','http://127.0.0.1:3001','--no-autoupdate','--protocol','http2','--metrics','127.0.0.1:20242'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});
  child.unref();fs.closeSync(out);fs.closeSync(err);
  let url;
  for(let count=0;count<60;count++){url=fs.readFileSync(error,'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];if(url)break;await wait(500)}
  if(!url)throw new Error('Cloudflare no informó la dirección de la API.');
  current={url,pid:child.pid,localOrigin:'http://127.0.0.1:3001'};writeJson(config.apiTunnelState,current);state.apiUrl=url;
  log(`API directa: ${url}`);
}
function updatePostman(){
  if(!state.apiUrl||!fs.existsSync(config.postmanCollection))return;
  const collection=readJson(config.postmanCollection,{}),base=collection.variable?.find(item=>item.key==='baseUrl');
  if(base&&base.value!==state.apiUrl){base.value=state.apiUrl;writeJson(config.postmanCollection,collection)}
}
async function prepare(component,sha){
  if(!/^[0-9a-f]{40}$/.test(sha))throw new Error('SHA inválido.');
  const repoRoot=under(root,'releases',component,sha);
  fs.mkdirSync(path.dirname(repoRoot),{recursive:true});
  const output=under(root,`${component}-${sha}.log`);
  const gitEnv={...process.env,GIT_TERMINAL_PROMPT:'0'};
  if(!fs.existsSync(repoRoot)){
    await run(config.git,['clone','--no-checkout','https://github.com/'+config.repositories[component]+'.git',repoRoot],{env:gitEnv,outputFile:output});
    await run(config.git,['checkout','--detach',sha],{cwd:repoRoot,env:gitEnv,outputFile:output});
  }
  const actual=(await run(config.git,['rev-parse','HEAD'],{cwd:repoRoot,capture:true})).trim();
  if(actual!==sha)throw new Error('La copia de preparación no corresponde al commit aprobado.');
  const dir=component==='backend'?path.join(repoRoot,'backend'):repoRoot;
  if(component==='frontend'){
    fs.copyFileSync(config.frontendEnv,path.join(dir,'.env.local'));
    const env=frontendEnvironment();delete env.NODE_ENV;
    await run(config.node,[config.corepackCli,'pnpm','install','--frozen-lockfile'],{cwd:dir,env,outputFile:output});
    await run(config.node,[config.corepackCli,'pnpm','build'],{cwd:dir,env,outputFile:output});
  }else{
    fs.copyFileSync(config.backendEnv,path.join(dir,'.env'));
    fs.mkdirSync(path.join(dir,'.local'),{recursive:true});
    const data=path.join(dir,'.local/postgres');
    if(!fs.existsSync(data))fs.symlinkSync(config.postgresData,data,'junction');
    if(fs.realpathSync(data).toLowerCase()!==fs.realpathSync(config.postgresData).toLowerCase())throw new Error('El directorio de PostgreSQL no coincide con el persistente.');
    const env={...process.env,...parseEnv(fs.readFileSync(config.backendEnv,'utf8')),NODE_ENV:'development'};
    await run(config.node,[config.npmCli,'ci','--include=dev'],{cwd:dir,env,outputFile:output});
    await run(config.node,[config.npmCli,'run','build'],{cwd:dir,env,outputFile:output});
    await run(config.node,[config.npmCli,'run','typecheck'],{cwd:dir,env,outputFile:output});
  }
  return {dir,sha};
}
async function backupDatabase(sha){
  const database=new URL(parseEnv(fs.readFileSync(config.backendEnv,'utf8')).DATABASE_URL);
  if(!['localhost','127.0.0.1'].includes(database.hostname)||database.pathname!=='/nutri_dev')throw new Error('El respaldo automático solo admite la base local nutri_dev.');
  if(await portOpen(Number(database.port||5432)))throw new Error('PostgreSQL sigue activo; se cancela la copia física para conservar su coherencia.');
  const backup=under(root,'backups',`${new Date().toISOString().replace(/[:.]/g,'-')}-${sha.slice(0,12)}`);
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  fs.cpSync(config.postgresData,backup,{recursive:true,dereference:false});
  state.lastDatabaseBackup=backup;save();
}
async function deploymentStatus(component,sha,status,runUrl){
  try{
    const repo=config.repositories[component];
    const deployments=await github(`repos/${repo}/deployments?sha=${sha}&environment=local-cloudflare&per_page=10`);
    if(!deployments.length)return;
    await github(`repos/${repo}/deployments/${deployments[0].id}/statuses`,{state:status,environment_url:component==='frontend'?config.publicOrigin:(state.apiUrl||config.publicOrigin),log_url:runUrl,description:status==='success'?'Versión activa y comprobada en la PC.':status==='failure'?'Falló el despliegue; ver estado local.':'Preparando la versión en la PC.'});
  }catch{log(`No se pudo publicar el estado de ${component} en GitHub.`)}
}
async function inspect(component){
  const repo=config.repositories[component];
  const branch=await github(`repos/${repo}/git/ref/heads/main`),sha=branch.object.sha;
  if(state.live[component].sha===sha)return;
  const response=await github(`repos/${repo}/actions/workflows/ci-local.yml/runs?branch=main&per_page=10`);
  const runInfo=response.workflow_runs.find(item=>item.head_sha===sha&&item.head_branch==='main'&&['push','workflow_dispatch'].includes(item.event)&&item.head_repository?.full_name===repo);
  const phase=runInfo?.conclusion||runInfo?.status||'sin-validación';
  const old=state.repositories[component];state.repositories[component]={sha,phase,runUrl:runInfo?.html_url};
  if(old?.sha!==sha||old?.phase!==phase)log(`${component}: ${sha.slice(0,12)} ${phase}`);
  if(phase!=='success'||state.attempts[component]===sha)return;
  state.attempts[component]=sha;save();
  const previous=structuredClone(state.live);let stopped=false;
  await deploymentStatus(component,sha,'in_progress',runInfo.html_url);
  try{
    log(`Preparando ${component} ${sha.slice(0,12)} sin detener la versión activa.`);
    const candidate=await prepare(component,sha);
    if((await github(`repos/${repo}/git/ref/heads/main`)).object.sha!==sha){delete state.attempts[component];log('Main avanzó; se espera la versión más reciente.');return}
    await stopLive();stopped=true;
    if(component==='backend')await backupDatabase(sha);
    state.live[component]=candidate;await startLive();
    state.repositories[component].phase='deployed';state.lastDeployment={component,sha,at:new Date().toISOString()};save();
    await deploymentStatus(component,sha,'success',runInfo.html_url);
    log(`DESPLEGADO ${component} ${sha.slice(0,12)}`);
  }catch(error){
    if(stopped){
      try{await stopLive()}catch{log('El candidato no terminó de cerrar.')}
      state.live=previous;
      try{await startLive()}catch{log('La recuperación requiere revisión local.')}
    }else state.live=previous;
    state.repositories[component].phase='deployment-failed';state.repositories[component].error=error.message;save();
    await deploymentStatus(component,sha,'failure',runInfo.html_url);log(`FALLO ${component}: ${error.message}`);
  }
}
try{
  log('Agente activo: valida CI de main y despliega ambos repositorios de forma serial.');
  do{
    try{await startLive();await ensureApiTunnel();updatePostman();save()}
    catch(error){log(`Inicio pendiente: ${error.message}`);if(args.includes('--once'))throw error;await wait(10000);continue}
    for(const component of ['frontend','backend']){
      try{await inspect(component)}catch(error){const previous=state.repositories[component]?.error;state.repositories[component]={...state.repositories[component],error:error.message};if(previous!==error.message)log(`${component}: ${error.message}`)}
    }
    try{await ensureApiTunnel();updatePostman()}catch(error){log(`Túnel de API: ${error.message}`)}save();
    if(args.includes('--once'))break;
    for(let second=0;second<(config.pollSeconds||30)&&running;second++){if(fs.existsSync(stopFile)){running=false;break}await wait(1000)}
  }while(running);
}finally{
  if(fs.existsSync(lockFile)&&readJson(lockFile,{}).pid===process.pid)fs.unlinkSync(lockFile);
  if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);
}
