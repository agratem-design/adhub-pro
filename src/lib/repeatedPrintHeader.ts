/** Runs inside each print document, so only browser APIs may be referenced here. */
function installRepeatedPrintHeader() {
  let shell: HTMLTableElement | undefined;
  let parent: HTMLElement | undefined;
  let originalNodes: Node[] = [];

  window.addEventListener('beforeprint', () => {
    if (shell || document.querySelector('.print-pagination-shell')) return;
    // Skip fixed-layout pages (posters/canvas/contracts with fixed .page cards)
    if (document.querySelector('.page:not(.paper), [data-print-page]:not(.paper), .canvas2d-print-page')) return;

    const header = document.querySelector<HTMLElement>(
      '.u-header, .print-header, .unified-header, .measurements-header, .header'
    );
    if (!header) return;

    // Locate the container holding the document
    const container = header.closest<HTMLElement>(
      '.paper, .print-container, .content, .measurements-container, [data-invoice-print]'
    ) || header.parentElement;
    if (!container) return;

    parent = container;

    // Find footer inside or next to this container
    const footer = parent.querySelector<HTMLElement>(
      '.u-footer, .print-footer, .unified-footer, .measurements-footer, .footer'
    ) || document.querySelector<HTMLElement>(
      '.u-footer, .print-footer, .unified-footer, .measurements-footer, .footer'
    );

    originalNodes = Array.from(parent.childNodes);

    shell = document.createElement('table');
    shell.className = 'print-pagination-shell';

    // Thead for repeating header
    const head = shell.createTHead();
    const headRow = head.insertRow();
    const headCell = headRow.insertCell();
    headCell.className = 'print-shell-header-cell';
    headCell.appendChild(header);

    // Tfoot for repeating footer (works natively across Chromium, Safari, Firefox)
    if (footer) {
      const foot = shell.createTFoot();
      const footRow = foot.insertRow();
      const footCell = footRow.insertCell();
      footCell.className = 'print-shell-footer-cell';
      footCell.appendChild(footer);
    }

    // Tbody for document body content
    const body = shell.createTBody();
    const bodyRow = body.insertRow();
    const contentCell = bodyRow.insertCell();
    contentCell.className = 'print-shell-content-cell';

    originalNodes.forEach(node => {
      if (node !== header && node !== footer && node !== shell) {
        contentCell.appendChild(node);
      }
    });

    parent.appendChild(shell);
  });

  window.addEventListener('afterprint', () => {
    if (!shell || !parent) return;
    originalNodes.forEach(node => {
      if (node !== shell) {
        parent!.appendChild(node);
      }
    });
    shell.remove();
    shell = undefined;
    parent = undefined;
  });
}

/** Repeat the header and render the footer once per native printed page. */
export function withRepeatedPrintHeader(html: string): string {
  if (html.includes('id="repeat-print-header"')) return html;
  const addition = `<style id="repeat-print-header">
  @media print {
    .print-pagination-shell {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      border: none !important;
      table-layout: fixed !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    }
    .print-pagination-shell > thead {
      display: table-header-group !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .print-pagination-shell > tfoot {
      display: table-footer-group !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .print-pagination-shell > tbody {
      display: table-row-group !important;
    }
    .print-pagination-shell > thead > tr > td,
    .print-pagination-shell > tfoot > tr > td,
    .print-pagination-shell > tbody > tr > td {
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      vertical-align: top !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .print-pagination-shell .u-header,
    .print-pagination-shell .print-header,
    .print-pagination-shell .unified-header,
    .print-pagination-shell .measurements-header,
    .print-pagination-shell .header {
      width: 100% !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-top: 0 !important;
    }
    .print-pagination-shell .u-footer,
    .print-pagination-shell .print-footer,
    .print-pagination-shell .unified-footer,
    .print-pagination-shell .measurements-footer,
    .print-pagination-shell .footer {
      width: 100% !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-bottom: 0 !important;
    }
    .print-pagination-shell .u-page-number,
    .print-pagination-shell .page-number {
      display: inline-block !important;
      visibility: visible !important;
    }
  }
  </style><script>(${installRepeatedPrintHeader.toString()})();</script>`;
  return html.replace(/<\/body>/i, addition + '</body>');
}
