'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="loading-screen"><h1>Something interrupted the view.</h1><p>Your saved workspace is still in the database. Try loading it again.</p><button className="button dark" onClick={reset}>Try again</button><a href="/workspace">Return to workspace</a></main>}
