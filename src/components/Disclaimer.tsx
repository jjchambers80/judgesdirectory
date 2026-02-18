/**
 * Legal disclaimer component displayed on ALL public-facing pages.
 * Required by Constitution III: Legal Safety & Neutrality.
 */
export default function Disclaimer() {
  return (
    <aside
      role="note"
      aria-label="Legal disclaimer"
      style={{
        padding: "1rem",
        marginTop: "2rem",
        borderTop: "1px solid var(--color-disclaimer-border)",
        fontSize: "0.875rem",
        color: "var(--color-disclaimer-text)",
        backgroundColor: "var(--color-disclaimer-bg)",
      }}
    >
      <p>
        <strong>Disclaimer:</strong> The information provided on this website is
        for general informational purposes only and does not constitute legal
        advice. While we strive to keep the information accurate and up to date,
        we make no representations or warranties of any kind, express or
        implied, about the completeness, accuracy, reliability, or suitability
        of the information. Any reliance you place on such information is
        strictly at your own risk. For official court and judge information,
        please refer to the relevant government websites.
      </p>
    </aside>
  );
}
