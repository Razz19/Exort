import { error } from '@sveltejs/kit';
import { getDocBySlug, getDocsCatalog } from '$lib/docs/registry';

import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const doc = await getDocBySlug([]);
  if (!doc) {
    throw error(404, 'Introduction page not found');
  }

  const { sidebar } = await getDocsCatalog();
  return {
    doc,
    sidebar
  };
};
