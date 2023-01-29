import type { FormKitOptionsProp } from "@formkit/inputs";
interface DropdownItem {
  label: string;
  value?: string;
}
const DefTypes: DropdownItem[] = [
  { label: "新闻", value: "news" },
  { label: "快讯", value: "flash" },
  { label: "文章", value: "article" },
  { label: "话题", value: "topic" },
];

function defTypeNames(value: string | undefined) {
  if (!value) {
    return "未定义";
  }
  let label = "未知";
  DefTypes.forEach((e) => {
    if (e.value === value) {
      label = e.label;
    }
  });
  return label;
}
export type { DropdownItem };
export { defTypeNames, DefTypes };
