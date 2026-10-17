import {apply} from './actions';
import type {State} from './engine';
export type ActivityChange = {record:string;field:string;before:string;after:string};
export type ActivityEvent = {id:string;at:string;actor:{id:string;name:string;email:string};action:string;summary:string;revision:number;changes:ActivityChange[]};
const labels:Record<string,string> = {product:'Saved product',archive:'Archived product',order:'Created purchase order',reorder:'Created reorder draft','order-status':'Updated purchase order',supplier:'Added supplier',scenario:'Saved scenario',history:'Updated sales history',read:'Marked notification read',settings:'Updated workspace settings'};
const display=(value:unknown)=>value===undefined?'—':typeof value==='string'?value:JSON.stringify(value);

// Called only on the server with identity from the authenticated request.
// The event and the business mutation live in the same revision-checked write.
export function applyWithActivity(original:State,input:unknown,actor:ActivityEvent['actor'],revision:number):State {
  const next=apply(structuredClone(original),input);
  const changes:ActivityChange[]=[];
  for(const key of ['products','suppliers','orders','scenarios'] as const){
    const previous=new Map(original[key].map(row=>[row.id,row]));
    for(const row of next[key]){
      const old=previous.get(row.id);
      const record=('name' in row?row.name:row.id)+` (${key})`;
      for(const [field,value] of Object.entries(row)){
        if(field==='id')continue;
        const before=old?(old as unknown as Record<string,unknown>)[field]:undefined;
        if(JSON.stringify(before)!==JSON.stringify(value))changes.push({record,field,before:display(before),after:display(value)});
      }
    }
  }
  for(const [field,value] of Object.entries(next.settings)){
    const before=original.settings[field as keyof State['settings']];
    if(before!==value)changes.push({record:'Workspace settings',field,before:display(before),after:display(value)});
  }
  for(const id of next.read.filter(id=>!original.read.includes(id)))changes.push({record:'Notification',field:'read',before:'Unread',after:id});
  if(!changes.length)return next;
  const type=(input as {type:string}).type;
  next.activity=[{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:actor.id,name:actor.name,email:actor.email},action:type,summary:labels[type]||'Updated workspace',revision,changes},...(original.activity||[])];
  return next;
}
