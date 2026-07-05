import type { NextPageContext } from "next";

type ErrorProps = {
  statusCode?: number;
};

export default function ErrorPage({ statusCode }: ErrorProps) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#666" }}>
          {statusCode ? `Error ${statusCode}` : "Unexpected application error"}
        </p>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};
