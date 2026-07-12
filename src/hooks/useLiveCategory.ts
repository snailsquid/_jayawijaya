import { useCallback } from 'react';
import { load } from 'js-yaml';
import type { LiveCategory, Module } from '../types/quiz';
import { parseModule, computeFileHash } from '../lib/parser';

interface JayaManifest {
  name: string;
  description: string;
  version: string;
  modules: string[];
}

function validateManifest(parsed: unknown): JayaManifest {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid jaya.yaml: expected an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('jaya.yaml must have a "name" field');
  }
  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    throw new Error('jaya.yaml must have a "version" field');
  }
  if (!Array.isArray(obj.modules) || obj.modules.length === 0) {
    throw new Error('jaya.yaml must have a non-empty "modules" array');
  }
  for (let i = 0; i < obj.modules.length; i++) {
    if (typeof obj.modules[i] !== 'string' || !obj.modules[i].trim()) {
      throw new Error(`jaya.yaml modules[${i}] must be a string`);
    }
  }
  return {
    name: obj.name as string,
    description: (typeof obj.description === 'string' ? obj.description : '') as string,
    version: obj.version as string,
    modules: obj.modules as string[],
  };
}

export function resolveRawUrl(input: string): string {
  const url = input.trim().replace(/\/+$/, '');

  const githubMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+(?:\/[^/]+)*))?$/);
  if (githubMatch) {
    const [, user, repo, branchPath] = githubMatch;
    const rawBranch = branchPath || 'main';
    return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${rawBranch}`;
  }

  return url;
}

async function fetchText(url: string): Promise<{ text: string; url: string }> {
  const resp = await fetch(url);
  if (resp.ok) {
    return { text: await resp.text(), url };
  }

  if (resp.status === 404 && url.includes('/refs/heads/main')) {
    const masterUrl = url.replace('/refs/heads/main', '/refs/heads/master');
    const masterResp = await fetch(masterUrl);
    if (masterResp.ok) {
      return { text: await masterResp.text(), url: masterUrl };
    }
  }

  throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
}

async function fetchYaml(url: string): Promise<{ data: unknown; url: string }> {
  const { text, url: effectiveUrl } = await fetchText(url);
  return { data: load(text), url: effectiveUrl };
}

export function useLiveCategory() {
  const fetchManifest = useCallback(async (rawBaseUrl: string): Promise<{ manifest: JayaManifest; baseUrl: string }> => {
    let manifestUrl: string;
    let baseUrl = rawBaseUrl;
    if (rawBaseUrl.endsWith('.yaml') || rawBaseUrl.endsWith('.yml')) {
      const lastSlash = rawBaseUrl.lastIndexOf('/');
      manifestUrl = rawBaseUrl;
      baseUrl = rawBaseUrl.substring(0, lastSlash);
    } else {
      manifestUrl = `${rawBaseUrl}/jaya.yaml`;
    }

    const { data, url: effectiveUrl } = await fetchYaml(manifestUrl);

    if (effectiveUrl !== manifestUrl) {
      baseUrl = effectiveUrl.replace('/jaya.yaml', '');
    }

    return { manifest: validateManifest(data), baseUrl };
  }, []);

  const fetchModules = useCallback(async (
    baseUrl: string,
    moduleFiles: string[],
    liveCategoryId: string,
    categoryName: string,
  ): Promise<Module[]> => {
    return Promise.all(
      moduleFiles.map(async (filePath) => {
        const url = `${baseUrl}/${filePath}`;
        const { text: content } = await fetchText(url);
        const hash = await computeFileHash(content);
        const fileName = filePath.split('/').pop() || filePath;
        const id = `live-${liveCategoryId}-${fileName}`;
        const module = parseModule(content, id);
        module.hash = hash;
        module.categoryId = categoryName;
        module.liveCategoryId = liveCategoryId;
        return module;
      })
    );
  }, []);

  const verifyUrl = useCallback(async (inputUrl: string): Promise<{ manifest: JayaManifest; baseUrl: string }> => {
    const rawUrl = resolveRawUrl(inputUrl);
    return fetchManifest(rawUrl);
  }, [fetchManifest]);

  const syncLiveCategory = useCallback(async (
    lc: LiveCategory,
    currentModules: Module[],
  ): Promise<{ modules: Module[]; liveCategory: LiveCategory }> => {
    const rawUrl = resolveRawUrl(lc.url);
    const { manifest, baseUrl } = await fetchManifest(rawUrl);

    const syncedModules = await fetchModules(baseUrl, manifest.modules, lc.id, manifest.name);

    const filtered = currentModules.filter(m => m.liveCategoryId !== lc.id);

    const updated: LiveCategory = {
      ...lc,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      moduleFiles: manifest.modules,
      lastUpdated: new Date().toISOString(),
      isSyncing: false,
    };

    return { modules: [...filtered, ...syncedModules], liveCategory: updated };
  }, [fetchManifest, fetchModules]);

  return { fetchManifest, fetchModules, verifyUrl, syncLiveCategory, resolveRawUrl };
}