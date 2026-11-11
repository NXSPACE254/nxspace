const segments = location.pathname.split("/").filter(Boolean);
const base = location.hostname.endsWith("github.io") && segments.length ? `/${segments[0]}/` : "/";
location.replace(`${base}index.html#home`);
