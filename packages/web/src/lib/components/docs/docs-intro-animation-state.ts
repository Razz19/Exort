let hasPlayedDocsIntroAnimation = false;

export const shouldPlayDocsIntroAnimation = (): boolean => {
  if (hasPlayedDocsIntroAnimation) {
    return false;
  }

  hasPlayedDocsIntroAnimation = true;
  return true;
};

export const resetDocsIntroAnimationForTests = () => {
  hasPlayedDocsIntroAnimation = false;
};
