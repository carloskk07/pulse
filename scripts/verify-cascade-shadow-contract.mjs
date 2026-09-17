import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function splitTopLevel(value, delimiter) {
  const parts = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (value.startsWith("/*", index)) {
      const end = value.indexOf("*/", index + 2);
      index = end === -1 ? value.length : end + 1;
      continue;
    }
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === delimiter && parentheses === 0 && brackets === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function parseDeclarations(body) {
  const declarations = new Map();
  for (const raw of splitTopLevel(body, ";")) {
    const declaration = raw.trim();
    if (!declaration) continue;

    let colon = -1;
    let parentheses = 0;
    let quote = null;
    for (let index = 0; index < declaration.length; index += 1) {
      const char = declaration[index];
      if (quote) {
        if (char === "\\") index += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      if (char === "(") parentheses += 1;
      else if (char === ")") parentheses = Math.max(0, parentheses - 1);
      else if (char === ":" && parentheses === 0) {
        colon = index;
        break;
      }
    }

    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim();
    let value = declaration.slice(colon + 1).trim();
    if (!property) continue;

    const important = /!important\s*$/i.test(value);
    value = value.replace(/!important\s*$/i, "").trim();
    declarations.set(property, { value, important });
  }
  return declarations;
}

function findBlockEnd(css, openBrace) {
  let depth = 1;
  let quote = null;

  for (let index = openBrace + 1; index < css.length; index += 1) {
    const char = css[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return css.length - 1;
}

function parseBaseRules(css) {
  const rules = [];
  let index = 0;

  while (index < css.length) {
    while (index < css.length) {
      if (/\s/.test(css[index])) {
        index += 1;
        continue;
      }
      if (css.startsWith("/*", index)) {
        const end = css.indexOf("*/", index + 2);
        index = end === -1 ? css.length : end + 2;
        continue;
      }
      break;
    }
    if (index >= css.length) break;

    const headerStart = index;
    let quote = null;
    let parentheses = 0;
    let brackets = 0;

    while (index < css.length) {
      const char = css[index];
      if (quote) {
        if (char === "\\") index += 2;
        else {
          if (char === quote) quote = null;
          index += 1;
        }
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        index += 1;
        continue;
      }
      if (css.startsWith("/*", index)) {
        const end = css.indexOf("*/", index + 2);
        index = end === -1 ? css.length : end + 2;
        continue;
      }
      if (char === "(") parentheses += 1;
      else if (char === ")") parentheses = Math.max(0, parentheses - 1);
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets = Math.max(0, brackets - 1);
      else if (parentheses === 0 && brackets === 0 && (char === "{" || char === ";")) break;
      index += 1;
    }

    if (index >= css.length) break;
    if (css[index] === ";") {
      index += 1;
      continue;
    }

    const header = css.slice(headerStart, index).trim();
    const openBrace = index;
    const closeBrace = findBlockEnd(css, openBrace);
    const body = css.slice(openBrace + 1, closeBrace);

    if (!header.startsWith("@")) {
      const declarations = parseDeclarations(body);
      if (declarations.size > 0) {
        for (const rawSelector of splitTopLevel(header, ",")) {
          const selector = rawSelector.replace(/\s+/g, " ").trim();
          if (selector) rules.push({ selector, declarations });
        }
      }
    }

    index = closeBrace + 1;
  }

  return rules;
}

const candidateFiles = [
  "app/styles/core.css",
  "app/styles/marketing.css",
  "app/styles/social-proof.css",
  "app/styles/product.css",
  "app/styles/referral.css",
  "app/styles/auth.css",
  "app/styles/functional.css",
  "app/styles/admin.css",
  "app/styles/visual-system.css",
  "app/styles/opportunity-intelligence.css",
  "app/styles/direct.css",
  "app/styles/business.css",
  "app/styles/admin-business.css",
  "app/styles/prospects.css",
  "app/styles/business-integration.css",
  "app/styles/completion.css",
  "app/styles/pulse-core.css",
  "app/styles/pulse-experience.css",
  "app/styles/momentum.css",
  "app/styles/share-studio.css",
  "app/styles/next-circuit.css",
  "app/styles/post-claim.css",
  "app/styles/luxe.css",
];

const finalAuthorityFiles = [
  "app/styles/theme.css",
  "app/styles/visual-hardening.css",
  "app/styles/sitewide-audit.css",
  "app/styles/touch-foundation.css",
  "app/styles/layout-authority.css",
];

const finalRules = new Map();
for (const path of finalAuthorityFiles) {
  for (const rule of parseBaseRules(read(path))) {
    const rows = finalRules.get(rule.selector) ?? [];
    rows.push({ path, declarations: rule.declarations });
    finalRules.set(rule.selector, rows);
  }
}

const shadowed = [];
for (const path of candidateFiles) {
  for (const rule of parseBaseRules(read(path))) {
    const later = finalRules.get(rule.selector) ?? [];
    if (later.length === 0) continue;

    const properties = [...rule.declarations.entries()];
    const fullyShadowed = properties.every(([property, source]) =>
      later.some(({ declarations }) => {
        const target = declarations.get(property);
        return Boolean(target) && (!source.important || target.important);
      }),
    );

    if (fullyShadowed) {
      shadowed.push({
        path,
        selector: rule.selector,
        properties: properties.map(([property]) => property),
        authorities: [...new Set(later.map((row) => row.path))],
      });
    }
  }
}

if (shadowed.length > 0) {
  const detail = shadowed
    .map((row) => `${row.path} :: ${row.selector} :: [${row.properties.join(", ")}] -> ${row.authorities.join(" | ")}`)
    .join("\n");
  throw new Error(`Found ${shadowed.length} fully shadowed base CSS rule(s) in current product layers:\n${detail}`);
}

console.log("Cascade shadow contract PASS");
