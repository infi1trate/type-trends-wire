// The last-resort error page (an SSR crash the app could not render): the same standalone brand page as the gate.
import { standaloneHead, standaloneMark } from "./standalone-page";
import { say } from "./voice";

export function renderErrorPage(): string {
  const v = say("site.failed.server");
  return `<!doctype html>
<html lang="en">
  <head>
${standaloneHead(v.title)}
  </head>
  <body>
    <header class="slab">Didn't load</header>
    <main><div class="box">
      ${standaloneMark()}
      <h1>${v.title}</h1>
      <p>${v.text}</p>
      <div class="row"><button onclick="location.reload()">Try again</button><a href="/">Go to the front page</a></div>
    </div></main>
  </body>
</html>`;
}
