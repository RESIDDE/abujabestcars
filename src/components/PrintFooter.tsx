import React from 'react';

interface PrintFooterProps {
  customerSignature?: string;
  companySignature?: string;
  showSignatures?: boolean;
}

// For use inside React DOM trees (like AuthorityToSell.tsx)
export function PrintFooter({ customerSignature, companySignature, showSignatures = false }: PrintFooterProps = {}) {
  const shouldShowSignatures = showSignatures || Boolean(customerSignature || companySignature);

  return (
    <div className="mt-4 pt-2 break-inside-avoid print:break-inside-avoid relative">
      {/* Signature section */}
      {shouldShowSignatures && (
        <div className="flex justify-between items-end mb-4 px-1">
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-800 mb-1.5">CUSTOMER'S SIGN</p>
            <div className="w-[160px] h-[36px] border border-gray-400 bg-white flex items-center justify-center overflow-hidden">
              {customerSignature ? (
                <img src={customerSignature} alt="Customer Signature" className="max-h-[34px] max-w-[150px] object-contain" />
              ) : null}
            </div>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-800 mb-1.5">ABUJA BEST CARS SIGN</p>
            <div className="w-[160px] h-[36px] border border-gray-400 bg-white flex items-center justify-center overflow-hidden">
              {companySignature ? (
                <img src={companySignature} alt="Company Signature" className="max-h-[34px] max-w-[150px] object-contain" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Thanks message */}
      <p className="text-center text-[12px] italic text-gray-700 my-3" style={{ fontFamily: 'Georgia, serif' }}>
        Thanks for your patronage
      </p>

      {/* Bottom geometric accent: Blue polygon on left + red stripe */}
      <div className="relative mt-2 h-7 w-full overflow-hidden">
        <div
          className="absolute left-0 bottom-0 w-9 h-7 bg-[#1E3A8A]"
          style={{ clipPath: 'polygon(0 100%, 100% 100%, 75% 0, 0 45%)' }}
        />
        <div className="absolute left-7 right-0 bottom-0 h-1 bg-[#C0392B]" />
      </div>
    </div>
  );
}

export function getPrintFooterHTML(customerSignature?: string, companySignature?: string, showSignatures: boolean = false) {
  const shouldShowSignatures = showSignatures || Boolean(customerSignature || companySignature);

  const custSigHTML = customerSignature 
    ? `<img src="${customerSignature}" style="max-height: 32px; max-width: 145px; object-fit: contain; display: block; margin: 0 auto;" />`
    : '';
  const compSigHTML = companySignature 
    ? `<img src="${companySignature}" style="max-height: 32px; max-width: 145px; object-fit: contain; display: block; margin: 0 auto;" />`
    : '';

  const signatureSectionHTML = shouldShowSignatures ? `
      <!-- Signature section -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; padding: 0 2px;">
        <div style="text-align: left;">
          <p style="font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #222; margin: 0 0 5px 0;">CUSTOMER'S SIGN</p>
          <div style="width: 155px; height: 34px; border: 1px solid #777; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${custSigHTML}
          </div>
        </div>
        <div style="text-align: left;">
          <p style="font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #222; margin: 0 0 5px 0;">ABUJA BEST CARS SIGN</p>
          <div style="width: 155px; height: 34px; border: 1px solid #777; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${compSigHTML}
          </div>
        </div>
      </div>
  ` : '';

  return `
    <div style="margin-top: 14px; padding-top: 4px; page-break-inside: avoid; break-inside: avoid; position: relative;">
      ${signatureSectionHTML}
      
      <!-- Thanks message -->
      <p style="text-align: center; font-family: Georgia, serif; font-size: 12px; font-style: italic; color: #444; margin: 10px 0 14px 0;">
        Thanks for your patronage
      </p>

      <!-- Bottom Graphic Bar -->
      <div style="position: relative; height: 26px; width: 100%; margin-top: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <svg style="position: absolute; left: 30px; right: 0; bottom: 0; width: calc(100% - 30px); height: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact;" viewBox="0 0 100 4" preserveAspectRatio="none">
          <rect x="0" y="0" width="100" height="4" fill="#C0392B" />
        </svg>
        <svg style="position: absolute; left: 0; bottom: 0; width: 44px; height: 26px; -webkit-print-color-adjust: exact; print-color-adjust: exact;" viewBox="0 0 44 26">
          <polygon points="0,12 32,0 44,26 0,26" fill="#1E3A8A" />
        </svg>
      </div>
    </div>
  `;
}


