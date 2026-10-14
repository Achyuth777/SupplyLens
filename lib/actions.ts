import {z} from 'zod';
import {type State, type Product,inventory,incoming} from './engine';
const amount=z.number().finite().min(0).max(10000000);const str=z.string().trim().min(1).max(120);const id=z.string().min(1).max(120);
const product=z.object({id:id.optional(),name:str,sku:str,category:str,warehouse:str,supplier:id,stock:amount.int(),cost:amount,price:amount,safety:amount.int(),lead:z.number().int().min(1).max(365)});
const item=z.object({product:id,quantity:amount.int().min(1)});
const schema=z.discriminatedUnion('type',[
 z.object({type:z.literal('product'),data:product}),z.object({type:z.literal('archive'),id}),
 z.object({type:z.literal('order'),supplier:id,items:z.array(item).min(1).max(30),expected:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),
 z.object({type:z.literal('reorder'),id}),z.object({type:z.literal('order-status'),id,status:z.enum(['Ordered','Received'])}),
 z.object({type:z.literal('supplier'),name:str,location:str}),
 z.object({type:z.literal('scenario'),data:z.object({name:str,product:id,delay:amount.max(60),surge:amount.max(200),capacity:amount.max(95),transport:amount.max(30),stock:amount.int(),safety:amount.int()})}),
 z.object({type:z.literal('history'),id,values:z.array(amount.int()).min(2).max(365)}),z.object({type:z.literal('read'),id}),z.object({type:z.literal('settings'),data:z.object({organization:str,name:str,notifications:z.boolean()})})]);
export function apply(s:State,input:unknown):State{const a=schema.parse(input);const uid=()=>crypto.randomUUID();const now=new Date().toISOString();const get=(id:string)=>{const p=s.products.find(p=>p.id===id&&!p.archived);if(!p)throw Error('Product not found');return p;};
 if(a.type==='product'){if(!s.suppliers.some(x=>x.id===a.data.supplier))throw Error('Supplier not found');if(s.products.some(p=>p.sku===a.data.sku&&p.id!==a.data.id))throw Error('SKU already exists');const old=a.data.id?get(a.data.id):null;const p:Product={...a.data,id:old?.id||uid(),history:old?.history||[]};if(old){s.products=s.products.map(x=>x.id===p.id?p:x);}else{s.products.push(p);}const change=p.stock-(old?.stock||0);if(change)s.movements.unshift({id:uid(),product:p.id,quantity:change,reason:old?'Inventory adjustment':'Opening balance',date:now});}
 if(a.type==='archive'){const p=get(a.id);if(s.orders.some(o=>o.status!=='Received'&&o.items.some(i=>i.product===p.id)))throw Error('Complete open purchase orders before archiving');p.archived=true;}
 if(a.type==='order'){if(!s.suppliers.some(x=>x.id===a.supplier))throw Error('Supplier not found');if(new Set(a.items.map(i=>i.product)).size!==a.items.length)throw Error('Combine duplicate line items');const items=a.items.map(i=>{const p=get(i.product);if(p.supplier!==a.supplier)throw Error('All products must belong to this supplier');return {...i,cost:p.cost};});if(!Number.isFinite(Date.parse(a.expected)))throw Error('Invalid delivery date');s.orders.unshift({id:`PO-${uid().slice(0,8).toUpperCase()}`,supplier:a.supplier,items,status:'Draft',created:now.slice(0,10),expected:a.expected});}
 if(a.type==='reorder'){const p=get(a.id);const quantity=inventory(p,incoming(s,p.id)).quantity;if(!quantity)throw Error('Existing orders already cover this recommendation');s.orders.unshift({id:`PO-${uid().slice(0,8).toUpperCase()}`,supplier:p.supplier,items:[{product:p.id,quantity,cost:p.cost}],status:'Draft',created:now.slice(0,10),expected:new Date(Date.now()+p.lead*86400000).toISOString().slice(0,10)});}
 if(a.type==='order-status'){const o=s.orders.find(o=>o.id===a.id);if(!o)throw Error('Order not found');if(a.status==='Ordered'){if(o.status!=='Draft')throw Error('Only draft orders can be placed');o.status='Ordered';}else{if(o.status!=='Ordered')throw Error('Only ordered shipments can be received once');for(const i of o.items){get(i.product).stock+=i.quantity;s.movements.unshift({id:uid(),product:i.product,quantity:i.quantity,reason:`Received ${o.id}`,date:now});}o.status='Received';o.received=now.slice(0,10);s.suppliers.find(x=>x.id===o.supplier)!.deliveries.unshift({expected:o.expected,received:o.received,lead:Math.max(0,(Date.parse(o.received)-Date.parse(o.created))/86400000)});}}
 if(a.type==='history')get(a.id).history=a.values;
 if(a.type==='supplier')s.suppliers.push({id:uid(),name:a.name,location:a.location,deliveries:[]});
 if(a.type==='scenario'){get(a.data.product);s.scenarios.unshift({...a.data,id:uid()});}
 if(a.type==='read'&&!s.read.includes(a.id))s.read.push(a.id);
 if(a.type==='settings')s.settings=a.data;
 return s;}
