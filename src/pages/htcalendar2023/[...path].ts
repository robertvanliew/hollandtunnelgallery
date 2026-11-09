import type { APIRoute } from 'astro';

// Catch-all for old Squarespace calendar URLs (/htcalendar2023/...) that have no exact match in
// redirects.json: send them to the Events page with a permanent redirect instead of a 404.
// Exact matches in redirects.json are served first by Vercel's routing, before this function.
export const prerender = false;
export const GET: APIRoute = ({ redirect }) => redirect('/events', 301);
