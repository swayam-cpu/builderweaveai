// Injects the WeaveDB client SDK into generated site HTML at serve time.
// This lets the generated app read data via window.WeaveDB.list(tableName).

export function injectWeaveDB(html: string, slug: string): string {
  const script = `
<script>
(function(){
  window.WEAVE_SITE = { slug: ${JSON.stringify(slug)} };
  var base = "/api/public/sites/" + encodeURIComponent(${JSON.stringify(slug)}) + "/data/";
  window.WeaveDB = {
    list: function(table){
      return fetch(base + encodeURIComponent(table))
        .then(function(r){ return r.json(); })
        .then(function(j){ return (j && j.rows) ? j.rows.map(function(r){ return Object.assign({ id: r.id, created_at: r.created_at }, r.data || {}); }) : []; });
    }
  };
})();
</script>`.trim();

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, script + "\n</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, "<body$1>\n" + script);
  return script + "\n" + html;
}
