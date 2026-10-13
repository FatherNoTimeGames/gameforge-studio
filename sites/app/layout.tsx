import type { ReactNode } from 'react';
import '../ui/src/index.css';

export const metadata = { title: 'GameForge Studio', description: 'Your game design workspace, connected to ChatGPT.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" className="dark"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head><body className="antialiased selection:bg-indigo-500/30 selection:text-indigo-200">{children}</body></html>;
}
