// Small Read-mode pieces: the standard page footer (the sparkline moved to the chart kit, U3).
import { DigestFooter } from "@/components/digest/Editorial";

export const ReadFooter = ({ terminal }: { terminal: string }) => <DigestFooter footer={{ methodology: "/#m-tiers", glossary: "/#g-sections", rss: "/digest/rss.xml", terminal, contact: null }} />;
