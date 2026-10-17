import type {State} from './engine';
export type SearchResult={id:string;kind:string;label:string;detail:string;view:string;recordId?:string};
const pages=[['overview','Overview','dashboard home summary'],['inventory','Inventory','stock products SKU warehouse'],['forecasting','Demand forecasting','sales history prediction'],['suppliers','Suppliers','vendors delivery reliability'],['simulator','Shock simulator','what if delay disruption scenario'],['reorder','Reorder engine','replenish restock purchasing'],['orders','Purchase orders','shipment receive procurement'],['analytics','Analytics & reports','report export metrics'],['notifications','Notifications','alerts signals'],['activity','Activity history','audit log who changed when timeline'],['settings','Settings','profile organization theme account']];
export function searchWorkspace(state:State,query:string):SearchResult[]{
  const supplier=(id:string)=>state.suppliers.find(s=>s.id===id)?.name||id;
  const results:SearchResult[]=[...pages.map(([view,label,detail])=>({id:`page-${view}`,kind:'Page',view,label,detail})),
    ...state.products.filter(p=>!p.archived).map(p=>({id:`product-${p.id}`,kind:'Product',label:p.name,detail:`${p.sku} · ${p.warehouse}`,view:'inventory',recordId:p.id})),
    ...state.suppliers.map(s=>({id:`supplier-${s.id}`,kind:'Supplier',label:s.name,detail:s.location,view:'suppliers',recordId:s.id})),
    ...state.orders.map(o=>({id:`order-${o.id}`,kind:'Order',label:o.id,detail:`${supplier(o.supplier)} · ${o.status}`,view:'orders',recordId:o.id})),
    ...state.scenarios.map(s=>({id:`scenario-${s.id}`,kind:'Scenario',label:s.name,detail:state.products.find(p=>p.id===s.product)?.name||s.product,view:'simulator',recordId:s.id}))];
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return results.filter(r=>words.every(w=>`${r.label} ${r.detail} ${r.kind}`.toLowerCase().includes(w))).slice(0,30);
}
