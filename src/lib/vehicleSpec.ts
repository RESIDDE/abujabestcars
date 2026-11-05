// Shared parser for proforma / quote line items.
// Turns a quote item (free-text description + linked vehicle + item columns) into structured spec fields.

const KNOWN_CONDITIONS = ["Brand New", "Foreign Used", "Locally Used", "Nigerian Used", "Used", "New"];

export interface VehicleSpec {
  title: string;
  condition: string;
  year: string;
  transmission: string;
  engine: string;
  vin: string;
  color: string;
  extras: string[];
}

const splitConditionFromTitle = (title: string): { title: string; condition: string } => {
  for (const c of KNOWN_CONDITIONS) {
    const re = new RegExp(`^${c}\\s+(?=\\S)`, "i");
    if (re.test(title)) return { title: title.replace(re, "").trim(), condition: c };
  }
  return { title, condition: "" };
};

export function parseVehicleSpec(item: any): VehicleSpec {
  const rawDesc: string = item?.vehicle_description || "";
  const v = item?.vehicles || {};

  let title = "";
  const subLines: string[] = [];

  if (rawDesc) {
    if (rawDesc.includes("\n")) {
      const lines = rawDesc.split("\n").map((l) => l.trim()).filter(Boolean);
      title = lines[0] || "";
      subLines.push(...lines.slice(1));
    } else {
      const cleanDesc = rawDesc.replace(/\s*\(([^)]+)\)/g, " - $1");
      const parts = cleanDesc.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
      title = parts[0] || "";
      parts.slice(1).forEach((part) => {
        if (/^(MODEL|TRANSMISSION|VIN|ENGINE|CONDITION|COLOU?R|YEAR|CYLINDERS?):/i.test(part)) {
          subLines.push(part);
        } else if (part.includes(",")) {
          part.split(",").map((s) => s.trim()).forEach((s) => {
            const lower = s.toLowerCase();
            if (lower.includes("auto") || lower.includes("manual") || lower.includes("cvt")) subLines.push(`Transmission: ${s}`);
            else if (/^v\d+/i.test(s) || lower.includes("electric") || lower.includes("cyl")) subLines.push(`Engine: ${s}`);
            else if (/^\d{4}$/.test(s)) subLines.push(`Model: ${s}`);
            else subLines.push(`Condition: ${s}`);
          });
        } else {
          subLines.push(part);
        }
      });
    }
  } else {
    title = `${v.make || ""} ${v.model || ""} ${v.trim || ""}`.trim();
  }

  const spec: VehicleSpec = { title, condition: "", year: "", transmission: "", engine: "", vin: "", color: "", extras: [] };

  subLines.forEach((line) => {
    const m = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (!m) { spec.extras.push(line); return; }
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (key === "condition") spec.condition = val;
    else if (key === "model" || key === "year") spec.year = val;
    else if (key === "transmission") spec.transmission = val;
    else if (key === "engine" || key.startsWith("cylinder")) spec.engine = val;
    else if (key === "vin" || key === "chassis") spec.vin = val;
    else if (key === "color" || key === "colour") spec.color = val;
    else spec.extras.push(line);
  });

  if (!spec.condition) {
    const split = splitConditionFromTitle(spec.title);
    if (split.condition) { spec.title = split.title; spec.condition = split.condition; }
  }

  // Fill gaps from dedicated item columns, then the linked vehicle record
  spec.condition ||= item?.condition || v.condition || "";
  spec.year ||= v.year ? String(v.year) : "";
  spec.transmission ||= item?.transmission || v.transmission || "";
  spec.engine ||= item?.cylinders || v.engine || "";
  spec.vin ||= item?.vin || v.vin || "";
  spec.color ||= v.color || "";
  spec.title ||= `${v.make || ""} ${v.model || ""}`.trim() || "Vehicle";

  return spec;
}
