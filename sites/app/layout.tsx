import type { ReactNode } from 'react';
import '../ui/src/index.css';

export const metadata = { title: 'GameForge Studio', description: 'Your game design workspace, connected to ChatGPT.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
