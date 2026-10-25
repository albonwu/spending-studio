import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Spending Studio',description:'A quiet place to understand your spending.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
