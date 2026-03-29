export interface HelpList {
  label: string;
  items: string[];
}

export interface HelpSection {
  title: string;
  paragraphs: string[];
  lists?: HelpList[];
}

export interface HelpPage {
  id: string;
  title: string;
  summary: string;
  sections: HelpSection[];
}
