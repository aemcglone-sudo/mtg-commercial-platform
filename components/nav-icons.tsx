/** Small stroke-based nav icons (Heroicons-outline style, 24x24) — kept as
 * one file of plain inline SVGs rather than an icon-library dependency,
 * since the sidebar only needs a dozen or so of these. */

type IconProps = { className?: string };
const base = 'w-full h-full';

export function CollectionIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375C2.754 3.75 2.25 4.254 2.25 4.875v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>;
}
export function InsightsIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4.5-4.5 4 4L20.25 4.5M20.25 4.5H15M20.25 4.5v5.25M4.5 19.5h15" /></svg>;
}
export function DecksIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h10.5A2.25 2.25 0 0119.5 6v13.5l-7.5-3.375L4.5 19.5V6a2.25 2.25 0 012.25-2.25z" /></svg>;
}
export function TrophyIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 003-3v-1.5a1.5 1.5 0 00-1.5-1.5H6a1.5 1.5 0 00-1.5 1.5v1.5a3 3 0 003 3m9 0v2.25m-9-2.25v2.25M6 5.25v3a4.5 4.5 0 004.5 4.5h3a4.5 4.5 0 004.5-4.5v-3M6 5.25h12M6 5.25a2.25 2.25 0 01-2.25-2.25v-.75h16.5v.75A2.25 2.25 0 0118 5.25" /></svg>;
}
export function NewsIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h6.75a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5H12v3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h6M7.5 15h6" /></svg>;
}
export function ChatIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.875a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.556 0 8.25-3.694 8.25-8.25S16.556 3.75 12 3.75 3.75 7.444 3.75 12c0 1.36.33 2.643.913 3.775L3.75 20.25l4.475-1.113A8.19 8.19 0 0012 20.25z" /></svg>;
}
export function LocalPlayIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>;
}
export function SimulatorIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 8.5v7l6-3.5-6-3.5z" /></svg>;
}
export function MarketIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.35-1.038m0 0l-3.75-1.038m3.75 1.038l-1.038 3.75" /></svg>;
}
export function ShopIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m-2.25 0h12l1 9.75a1.5 1.5 0 01-1.492 1.65H5.492A1.5 1.5 0 014 20.25l1-9.75z" /></svg>;
}
export function SettingsIcon({ className = base }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.752.43.992l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.752-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
export function DotIcon({ className = base }: IconProps) {
  return <svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /></svg>;
}
