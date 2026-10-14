import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'SupplyLens — See what’s next.',description:'Predictive supply chain intelligence. Inventory, forecasts and disruption planning in one connected workspace.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
