import { parseAssistantSegments, prettifyHeader } from '../../utils/assistantContent.js';

/**
 * Built-in default renderer.
 * Handles plain text responses and responses that contain markdown tables.
 * Tables are rendered as clean, scrollable HTML <table> elements.
 *
 * Payload shape: { rawText: string }
 */
export function DefaultRenderer({ payload }) {
  const segments = parseAssistantSegments(payload?.rawText ?? '');

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === 'table') {
          return (
            <div key={`tbl-${idx}`} className="ce-table-wrap">
              <table className="ce-table">
                <thead>
                  <tr>
                    {segment.headers.map((h, hi) => (
                      <th key={hi} className="ce-table-th">
                        {prettifyHeader(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {segment.rows.map((row, ri) => (
                    <tr key={ri} className="ce-table-tr">
                      {row.map((cell, ci) => (
                        <td key={ci} className="ce-table-td">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <pre key={`txt-${idx}`} className="ce-bubble-text">
            {segment.text}
          </pre>
        );
      })}
    </>
  );
}
