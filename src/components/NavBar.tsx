import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/meta", label: "Meta Radar" },
  { href: "/hot", label: "Hot Market" },
];

export default function NavBar() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--panel)]">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-[var(--accent)]">
          POE2 Meta Radar
        </Link>
        <ul className="flex gap-4 text-sm">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="opacity-80 transition hover:opacity-100">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
