import { Asset } from 'expo-asset';

function cacheResources() {
  const resources = [require('../assets/contentScript.txt')];

  return Asset.loadAsync(resources);
}

export default cacheResources;
