// The last-resort error page (an SSR crash the app could not render): the same standalone brand page as the gate.
import { standaloneHead, standaloneMark } from "./standalone-page";

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
${standaloneHead("This page didn't load")}
  </head>
  <body>
    <header class="slab">Something went wrong</header>
    <main><div class="box">
      ${standaloneMark()}
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try again, or head back to the front page.</p>
      <div class="row"><button onclick="location.reload()">Try again</button><a href="/">Go to the front page</a></div>
    </div></main>
  </body>
</html>`;
}
