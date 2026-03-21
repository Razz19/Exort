import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoWorkerFactory = () => Worker;

type MonacoEnvironmentShape = {
  getWorker: (_moduleId: string, label: string) => Worker;
};

const workerFactories: Record<string, MonacoWorkerFactory> = {
  json: () => new jsonWorker(),
  css: () => new cssWorker(),
  scss: () => new cssWorker(),
  less: () => new cssWorker(),
  html: () => new htmlWorker(),
  handlebars: () => new htmlWorker(),
  razor: () => new htmlWorker(),
  typescript: () => new tsWorker(),
  javascript: () => new tsWorker(),
  default: () => new editorWorker()
};

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironmentShape;
  }
}

export function setupMonacoEnvironment(): void {
  if (typeof window === 'undefined') return;
  if (window.MonacoEnvironment?.getWorker) return;

  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string): Worker {
      const createWorker =
        workerFactories[label] ?? workerFactories.default ?? (() => new editorWorker());
      return createWorker();
    }
  };
}
