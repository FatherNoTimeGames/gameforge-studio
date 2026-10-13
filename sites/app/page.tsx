import { headers } from 'next/headers';
import Studio from './studio';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const h = await headers();
  if (!h.get('oai-authenticated-user-id')) {
    return <main className="p-8 text-zinc-100"><h1 className="text-2xl mb-4">GameForge Studio</h1><a className="underline" href="/signin-with-chatgpt?return_to=/" target="_top">Sign in with ChatGPT</a></main>;
  }
  return <Studio />;
}
