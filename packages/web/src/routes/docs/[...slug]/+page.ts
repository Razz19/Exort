import { error, redirect } from '@sveltejs/kit';

import { getDocBySlug, getDocsCatalog } from '$lib/docs/registry';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const slugParts = params.slug.split('/').filter(Boolean);
  if (slugParts.length === 1 && slugParts[0].toLowerCase() === 'introduction') {
    throw redirect(308, '/docs');
  }

  const doc = await getDocBySlug(slugParts);

  if (!doc) {
    throw error(404, 'Documentation page not found');
  }

  const { sidebar } = await getDocsCatalog();

  return {
    doc,
    sidebar
  };
};
