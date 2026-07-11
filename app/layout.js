import "./globals.css";

export const metadata = {
  title: "NSC Qualification Calculator",
  description:
    "Simulate Neighborhood World Cup group results and see who moves into the qualifying places.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
