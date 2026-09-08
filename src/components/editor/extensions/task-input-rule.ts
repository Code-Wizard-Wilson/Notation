import { Extension, InputRule } from "@tiptap/core";

export const TaskInputRule = Extension.create({
  name: "taskInputRule",

  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[([ xX])\]\s$/,
        handler: ({ range, match, chain }) => {
          const checked = match[1]?.toLowerCase() === "x";
          chain()
            .deleteRange(range)
            .toggleTaskList()
            .updateAttributes("taskItem", { checked })
            .run();
        },
      }),
    ];
  },
});
