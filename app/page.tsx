export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "72px" }}>🦁</div>
      <h1 style={{ fontSize: "32px", fontWeight: 800 }}>
        첫 화면이 떴습니다!
      </h1>
      <p style={{ fontSize: "18px", color: "#6b7280", lineHeight: 1.7 }}>
        여기까지 왔다면 준비 완료입니다.
      </p>
    </main>
  );
}
