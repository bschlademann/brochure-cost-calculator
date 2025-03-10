import React, { useState, useEffect } from 'react';
import './BrochureCalculator.css';

type Tier = { min: number; price: number };

const bwTiers: Tier[] = [
  { min: 1000, price: 0.04 },
  { min: 500, price: 0.05 },
  { min: 250, price: 0.06 },
  { min: 100, price: 0.07 },
  { min: 50, price: 0.09 },
  { min: 1, price: 0.1 },
];

const colorTiers: Tier[] = [
  { min: 5000, price: 0.38 },
  { min: 1000, price: 0.18 },
  { min: 500, price: 0.28 },
  { min: 250, price: 0.35 },
  { min: 100, price: 0.43 },
  { min: 50, price: 0.69 },
  { min: 1, price: 0.84 },
];

const getPrice = (tiers: Tier[], quantity: number): number => {
  for (const tier of tiers) {
    if (quantity >= tier.min) return tier.price;
  }
  return tiers[tiers.length - 1].price;
};

interface Breakdown {
  swCount: number;              // Original S/W impression count
  effectiveSwCount: number;     // A4-equivalent count (doubled if A3)
  swUnitPrice: number;          // Normal unit price per additional S/W impression
  swSurcharge: number;          // Surcharge for the first S/W impression (if applicable)
  swTotal: number;              // Total S/W cost
  colorCount: number;           // Original color impression count
  effectiveColorCount: number;  // A4-equivalent count (doubled if A3)
  colorUnitPrice: number;       // Normal unit price per additional color impression
  colorSurcharge: number;       // Surcharge for the first color impression (if applicable)
  colorTotal: number;           // Total color cost
  bindingCount: number;         // Number of bindings
  bindingCost: number;          // Total binding cost
  totalCost: number;            // Grand total
}

// Parse input for colored pages (accepts individual numbers and ranges like "7-19")
const parseColorPages = (
  input: string,
  maxPage: number
): { pages: number[]; error?: string } => {
  if (!/^[0-9,\-\s]*$/.test(input)) {
    return { pages: [], error: "Ungültige Zeichen. Erlaubt: Zahlen, Komma, Bindestrich." };
  }
  const resultSet = new Set<number>();
  const tokens = input.split(',').map(t => t.trim()).filter(t => t !== '');
  for (const token of tokens) {
    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-').map(t => t.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start > end) {
        return { pages: [], error: `Ungültiger Bereich: "${token}"` };
      }
      for (let i = start; i <= end; i++) {
        if (i > maxPage)
          return { pages: [], error: `Seitenzahl ${i} überschreitet die Gesamtseitenzahl (${maxPage}).` };
        resultSet.add(i);
      }
    } else {
      const num = parseInt(token, 10);
      if (isNaN(num)) continue;
      if (num > maxPage)
        return { pages: [], error: `Seitenzahl ${num} überschreitet die Gesamtseitenzahl (${maxPage}).` };
      resultSet.add(num);
    }
  }
  return { pages: Array.from(resultSet) };
};

/**
 * calculateBrochureBreakdown computes a detailed cost breakdown.
 *
 * - The brochure is arranged into impressions (2 per sheet, each with 2 pages).
 * - An impression is considered colored if at least one page (within the actual brochure page count) is marked as colored.
 *
 * Surcharge rules:
 * - If there is at least one color impression and the effective color count (adjusted for A3) is less than 50,
 *   one color impression is charged at a surcharge (A4: 1.2€, A3: 2.4€) and the remaining at the normal unit price.
 * - Otherwise, if there are no color impressions and the effective S/W count is less than 50,
 *   one S/W impression is charged at a surcharge (A4: 0.45€, A3: 0.9€) and the remaining at the normal unit price.
 *
 * Binding cost applies only when the brochure has at least 5 pages.
 *
 * Important: Empty (filled) pages are not counted.
 */
const calculateBrochureBreakdown = (
  pagesPerBrochure: number,
  colorPages: number[],
  brochureCount: number,
  isA3: boolean
): Breakdown => {
  const totalPages = Math.ceil(pagesPerBrochure / 4) * 4;
  const sheets = totalPages / 4;
  let totalBW = 0;
  let totalColor = 0;

  for (let j = 0; j < sheets; j++) {
    const pageA = totalPages - 2 * j;
    const pageB = 1 + 2 * j;
    const pageC = 2 + 2 * j;
    const pageD = totalPages - (2 * j + 1);
    const impressions = [
      [pageA, pageB],
      [pageC, pageD],
    ];
    impressions.forEach(pair => {
      if (pair.some(p => p <= pagesPerBrochure)) {
        const isColorImpression = pair.some(p => p <= pagesPerBrochure && colorPages.includes(p));
        if (isColorImpression) totalColor++;
        else totalBW++;
      }
    });
  }

  totalColor *= brochureCount;
  totalBW *= brochureCount;

  const effectiveColor = isA3 ? totalColor * 2 : totalColor;
  const effectiveBW = isA3 ? totalBW * 2 : totalBW;
  const factor = isA3 ? 2 : 1;

  const swUnit = getPrice(bwTiers, effectiveBW) * factor;
  const colorUnit = getPrice(colorTiers, effectiveColor) * factor;

  let swSurcharge = 0;
  let colorSurcharge = 0;
  let swCost = 0;
  let colorCost = 0;
  const totalImpressions = totalColor + totalBW;

  if (totalImpressions > 0) {
    if (totalColor > 0 && effectiveColor < 50) {
      colorSurcharge = isA3 ? 2.4 : 1.2;
      colorCost = colorSurcharge + (totalColor - 1) * colorUnit;
      swCost = totalBW * swUnit;
    } else if (totalColor === 0 && effectiveBW < 50) {
      swSurcharge = isA3 ? 0.9 : 0.45;
      swCost = swSurcharge + (totalBW - 1) * swUnit;
      colorCost = 0;
    } else {
      swCost = totalBW * swUnit;
      colorCost = totalColor * colorUnit;
    }
  }

  const bindingCost = pagesPerBrochure < 5 ? 0 : brochureCount * 0.18;
  const bindingCount = pagesPerBrochure < 5 ? 0 : brochureCount;
  const totalCost = swCost + colorCost + bindingCost;

  return {
    swCount: totalBW,
    effectiveSwCount: effectiveBW,
    swUnitPrice: swUnit,
    swSurcharge,
    swTotal: swCost,
    colorCount: totalColor,
    effectiveColorCount: effectiveColor,
    colorUnitPrice: colorUnit,
    colorSurcharge,
    colorTotal: colorCost,
    bindingCount,
    bindingCost,
    totalCost,
  };
};

const BrochureCalculator: React.FC = () => {
  const [pages, setPages] = useState<number>(8);
  const [colorPagesInput, setColorPagesInput] = useState<string>('');
  const [brochureCount, setBrochureCount] = useState<number>(1);
  const [isA3, setIsA3] = useState<boolean>(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const { pages: parsedPages, error: parseError } = parseColorPages(colorPagesInput, pages);
    if (parseError) {
      setError(parseError);
      setBreakdown(null);
      return;
    }
    setError('');
    const result = calculateBrochureBreakdown(pages, parsedPages, brochureCount, isA3);
    setBreakdown(result);
  }, [pages, colorPagesInput, brochureCount, isA3]);

  const handleColorPagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const filtered = value.replace(/[^0-9,\-\s]/g, '');
    setColorPagesInput(filtered);
  };

  // Helper to format category display.
  // Returns displayCount as "1/(n-1)" if surcharge exists, else just the count.
  // Similarly for displayPrice: "€X/€Y" if surcharge exists, else just unit price.
  const formatCategory = (surcharge: number, effectiveCount: number, unitPrice: number) => {
    if (surcharge > 0 && effectiveCount > 0) {
      const additional = effectiveCount - 1;
      return {
        displayCount: `1/${additional}`,
        displayPrice: `€${surcharge.toFixed(2)}/€${unitPrice.toFixed(2)}`,
      };
    } else {
      return {
        displayCount: `${effectiveCount}`,
        displayPrice: `€${unitPrice.toFixed(2)}`,
      };
    }
  };

  return (
    <div className="calculator-container">
      <h2>Broschürenkostenrechner</h2>
      <table className="input-table">
        <tbody>
          <tr>
            <td className="input-cell">
              <label>
              Anzahl Broschüren:
                <input
                  type="number"
                  min="1"
                  value={brochureCount}
                  onChange={e => setBrochureCount(parseInt(e.target.value, 10) || 0)}
                  className="input-number"
                />
              </label>
            </td>
            <td className="input-cell">
              <label>
                <input
                  type="checkbox"
                  checked={isA3}
                  onChange={e => setIsA3(e.target.checked)}
                  className="input-checkbox"
                />
                A3-A4 Broschüren
              </label>
            </td>
          </tr>
          <tr>
            <td className="input-cell">
              <label>
                Seiten je Broschüre:
                <input
                  type="number"
                  min="1"
                  value={pages}
                  onChange={e => setPages(parseInt(e.target.value, 10) || 0)}
                  className="input-number"
                />
              </label>
            </td>
            <td className="input-cell">
              <label>
                Seitenzahlen farbe:<span className="input-hint">
              (z.B. 1, 3-5, 7)
            </span> 
                <input
                  type="text"
                  value={colorPagesInput}
                  onChange={handleColorPagesChange}
                  className="input-text"
                />
              </label>
            </td>
          </tr>

        </tbody>
      </table>
      {error && <div className="error">{error}</div>}
      {breakdown && (
        <>
          <h3>Kostenzusammenfassung:</h3>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Anzahl (A4-Drucke)</th>
                <th>Einzelpreis</th>
                <th>Gesamtpreis</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.swTotal > 0 && (
                <tr>
                  <td>Schwarz-Weiß-Drucke</td>
                  <td>
                    {formatCategory(breakdown.swSurcharge, breakdown.effectiveSwCount, breakdown.swUnitPrice)
                      .displayCount}
                  </td>
                  <td>
                    {formatCategory(breakdown.swSurcharge, breakdown.effectiveSwCount, breakdown.swUnitPrice)
                      .displayPrice}
                  </td>
                  <td>€{breakdown.swTotal.toFixed(2)}</td>
                </tr>
              )}
              {breakdown.colorTotal > 0 && (
                <tr>
                  <td>Farbdrucke</td>
                  <td>
                    {formatCategory(
                      breakdown.colorSurcharge,
                      breakdown.effectiveColorCount,
                      breakdown.colorUnitPrice
                    ).displayCount}
                  </td>
                  <td>
                    {formatCategory(
                      breakdown.colorSurcharge,
                      breakdown.effectiveColorCount,
                      breakdown.colorUnitPrice
                    ).displayPrice}
                  </td>
                  <td>€{breakdown.colorTotal.toFixed(2)}</td>
                </tr>
              )}
              {breakdown.bindingCost > 0 && (
                <tr>
                  <td>Bindung</td>
                  <td>{breakdown.bindingCount}</td>
                  <td>€0.18</td>
                  <td>€{breakdown.bindingCost.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div>
            <strong>Gesamtkosten:</strong> €{breakdown.totalCost.toFixed(2)} 
            
            {brochureCount > 1 ? ` (je Exemplar €${(breakdown.totalCost/brochureCount).toFixed(2)})` : ""}
          
          </div>
        </>
      )}
    </div>
  );
};

export default BrochureCalculator;
