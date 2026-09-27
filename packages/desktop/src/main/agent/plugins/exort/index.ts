import type { Plugin } from '@opencode/plugin';
import arduinoCompile from '../../tools/arduinoCompile.js';
import platformioCompile from '../../tools/platformioCompile.js';

// A plain definition avoids runtime dependency resolution outside the packaged app.
export default {
  id: 'exort.embedded',
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: 'arduinoCompile', description: arduinoCompile.description, input: arduinoCompile.input,
        async execute(input, context) {
          const session = await ctx.session.get({ sessionID: context.sessionID });
          return { content: await arduinoCompile.execute(input as Parameters<typeof arduinoCompile.execute>[0], {
            directory: session.location.directory, abort: context.signal
          }) };
        }
      });
      editor.add({
        name: 'platformioCompile', description: platformioCompile.description, input: platformioCompile.input,
        async execute(input, context) {
          const session = await ctx.session.get({ sessionID: context.sessionID });
          return { content: await platformioCompile.execute(input as Parameters<typeof platformioCompile.execute>[0], {
            directory: session.location.directory, abort: context.signal
          }) };
        }
      });
    });
  }
} satisfies Plugin.Plugin;
