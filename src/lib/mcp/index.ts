import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSites from "./tools/list-sites";
import getSite from "./tools/get-site";
import createSite from "./tools/create-site";
import setSitePublished from "./tools/set-site-published";
import listSiteTables from "./tools/list-site-tables";
import listSiteRows from "./tools/list-site-rows";
import insertSiteRow from "./tools/insert-site-row";
import listMail from "./tools/list-mail";
import sendMail from "./tools/send-mail";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "weave-studio",
  title: "Weave Studio",
  version: "0.1.0",
  instructions:
    "Tools for Weave Studio, an AI website builder. Each caller acts as their own signed-in Weave account. Use list_sites/get_site to inspect sites, create_site and set_site_published to manage them, list_site_tables/list_site_rows/insert_site_row for a site's native database, and list_mail/send_mail for Weave Mail (internal @weave.com messaging).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSites,
    getSite,
    createSite,
    setSitePublished,
    listSiteTables,
    listSiteRows,
    insertSiteRow,
    listMail,
    sendMail,
  ],
});
