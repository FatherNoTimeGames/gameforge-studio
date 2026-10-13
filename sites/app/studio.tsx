'use client';
import dynamic from 'next/dynamic';

// The existing workspace uses browser storage, downloads and viewport APIs.
const App = dynamic(() => import('../ui/src/App'), { ssr: false });
export default function Studio() { return <App chatgptMode />; }
