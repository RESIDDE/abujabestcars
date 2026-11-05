import React from 'react';
import { BRAND_DARK } from '@/components/PrintHeader';

interface PrintFooterProps {
  customerSignature?: string | null;
  companySignature?: string | null;
  customerSignatureDate?: string | null;
  companySignatureDate?: string | null;
  showSignatures?: boolean;
  customerLabel?: string;
  companyLabel?: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '');

function SignSlot({
  label,
  signature,
  date,
  align,
}: {
  label: string;
  signature?: string | null;
  date?: string | null;
  align: 'left' | 'right';
}) {
  return (
    <div style={{ textAlign: align, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, minWidth: 190 }}>
      <div
        style={{
          height: 46,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          paddingBottom: 2,
        }}
      >
        {signature ? (
          <img
            src={signature}
            alt={label}
            style={{ maxHeight: 44, maxWidth: 180, objectFit: 'contain', filter: 'brightness(0)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
          />
        ) : null}
      </div>
      <div style={{ borderTop: '1px solid #333', width: 190, marginLeft: align === 'right' ? 'auto' : 0, paddingTop: 3 }}>
        {label}
        {date && <div style={{ fontSize: 10, color: '#555', fontStyle: 'normal', marginTop: 1 }}>{fmtDate(date)}</div>}
      </div>
    </div>
  );
}

/**
 * Footer matching the "Registered Vehicle" Cash/Credit Invoice:
 * Customer's Sign · Thanks for your patronage · Manager's Sign, followed by the dark brand bar.
 */
export function PrintFooter({
  customerSignature,
  companySignature,
  customerSignatureDate,
  companySignatureDate,
  showSignatures = false,
  customerLabel = "Customer's Sign",
  companyLabel = "Manager's Sign",
}: PrintFooterProps = {}) {
  const shouldShowSignatures = showSignatures || Boolean(customerSignature || companySignature);

  return (
    <div className="break-inside-avoid print:break-inside-avoid" style={{ marginTop: 22, position: 'relative', zIndex: 1 }}>
      {shouldShowSignatures ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <SignSlot label={customerLabel} signature={customerSignature} date={customerSignatureDate} align="left" />
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 12, textAlign: 'center', paddingBottom: 6 }}>
            Thanks for your patronage
          </div>
          <SignSlot label={companyLabel} signature={companySignature} date={companySignatureDate} align="right" />
        </div>
      ) : (
        <p style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 12, color: '#333', margin: '6px 0' }}>
          Thanks for your patronage
        </p>
      )}

      {/* Dark brand bar (as on the printed booklet) */}
      <div
        style={{
          marginTop: 12,
          height: 9,
          width: '100%',
          background: BRAND_DARK,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as React.CSSProperties}
      />
    </div>
  );
}

export function getPrintFooterHTML(
  customerSignature?: string | null,
  companySignature?: string | null,
  showSignatures: boolean = false,
) {
  const shouldShowSignatures = showSignatures || Boolean(customerSignature || companySignature);

  const slot = (label: string, sig: string | null | undefined, align: 'left' | 'right') => `
    <div style="text-align: ${align}; font-family: Georgia, serif; font-style: italic; font-size: 13px; min-width: 190px;">
      <div style="height: 46px; display: flex; align-items: flex-end; justify-content: ${align === 'right' ? 'flex-end' : 'flex-start'}; padding-bottom: 2px;">
        ${sig ? `<img src="${sig}" style="max-height: 44px; max-width: 180px; object-fit: contain; filter: brightness(0); -webkit-filter: brightness(0);" />` : ''}
      </div>
      <div style="border-top: 1px solid #333; width: 190px; ${align === 'right' ? 'margin-left: auto;' : ''} padding-top: 3px;">${label}</div>
    </div>`;

  const signatureSection = shouldShowSignatures
    ? `
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        ${slot("Customer's Sign", customerSignature, 'left')}
        <div style="font-family: Georgia, serif; font-style: italic; font-size: 12px; text-align: center; padding-bottom: 6px;">Thanks for your patronage</div>
        ${slot("Manager's Sign", companySignature, 'right')}
      </div>`
    : `<p style="text-align: center; font-family: Georgia, serif; font-style: italic; font-size: 12px; color: #333; margin: 6px 0;">Thanks for your patronage</p>`;

  return `
    <div style="margin-top: 22px; page-break-inside: avoid; break-inside: avoid; position: relative; z-index: 1;">
      ${signatureSection}
      <div style="margin-top: 12px; height: 9px; width: 100%; background: ${BRAND_DARK}; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
    </div>
  `;
}
