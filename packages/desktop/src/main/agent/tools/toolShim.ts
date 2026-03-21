export type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  worktree: string;
  abort: AbortSignal;
  metadata: () => unknown;
  ask: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
};

type ToolSchemaKind = "string" | "boolean";

type ToolSchemaDescriptor = {
  kind: ToolSchemaKind;
  isOptional: boolean;
  description?: string;
  optional(): ToolSchemaDescriptor;
  describe(text: string): ToolSchemaDescriptor;
};

type ToolDefinition<TArgs> = {
  description: string;
  args: Record<string, ToolSchemaDescriptor>;
  execute(args: TArgs, context: unknown): Promise<string>;
};

function createSchemaDescriptor(kind: ToolSchemaKind): ToolSchemaDescriptor {
  return {
    kind,
    isOptional: false,
    optional() {
      this.isOptional = true;
      return this;
    },
    describe(text: string) {
      this.description = text;
      return this;
    },
  };
}

type ToolFactory = {
  <TArgs>(definition: ToolDefinition<TArgs>): ToolDefinition<TArgs>;
  schema: {
    string(): ToolSchemaDescriptor;
    boolean(): ToolSchemaDescriptor;
  };
};

export const tool: ToolFactory = Object.assign(
  <TArgs>(definition: ToolDefinition<TArgs>): ToolDefinition<TArgs> => definition,
  {
    schema: {
      string: () => createSchemaDescriptor("string"),
      boolean: () => createSchemaDescriptor("boolean"),
    },
  },
);
