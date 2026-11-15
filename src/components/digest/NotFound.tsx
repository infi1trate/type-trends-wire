import { Link } from "@tanstack/react-router";
import { DIGEST_NAME } from "@/lib/site";
import { DigestShell } from "./Editorial";
export function DigestNotFound({ title, body }: { title: string; body: string }) {
  return <DigestShell label="Not found">
    <section className="ed-wrap py-20">
      <p className="ed-kicker">{DIGEST_NAME}</p>
      <h1 className="ed-cover mt-3">{title}</h1>
      <p className="ed-standfirst mt-5">{body}</p>
      <p className="ed-data mt-8 flex flex-wrap gap-x-6"><Link to="/digest" className="ed-tap">Read the latest issue →</Link><Link to="/digest/archive" className="ed-tap">All issues</Link><Link to="/" className="ed-tap">Open the terminal</Link></p>
    </section>
  </DigestShell>;
}
