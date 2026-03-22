/**
 * ProfileRules Page
 *
 * Game rules and help documentation.
 */

import { useState } from 'react';
import rulesContent from '../../data/rules-content.json';
import statsConfig from '../../data/stats-config.json';
import rolesData from '../../data/roles.json';

interface RuleSection {
  id: string;
  title: string;
  icon: string;
  content: ContentBlock[];
}

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'stats-list' }
  | { type: 'roles-list' }
  | { type: 'xp-table'; items: { action: string; xp: string; note: string }[] };

const ZONE_NAMES: Record<string, string> = {
  center: 'Центр',
  residential: 'Жилая зона',
  industrial: 'Промышленная зона',
  green: 'Зелёная зона',
  unknown: 'Неизвестная территория',
};

export function ProfileRules() {
  const [expandedSection, setExpandedSection] = useState<string | null>('how-to-play');

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const renderContent = (blocks: ContentBlock[]) => {
    return blocks.map((block, index) => {
      switch (block.type) {
        case 'paragraph':
          return (
            <p key={index} className="text-[#778DA9] mb-3">
              {block.text}
            </p>
          );

        case 'heading':
          return (
            <h4 key={index} className="font-semibold text-[#E0E1DD] mt-4 mb-2">
              {block.text}
            </h4>
          );

        case 'list':
          return (
            <ul key={index} className="space-y-2 mb-3">
              {block.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[#778DA9]">
                  <span className="text-[#D4A017] mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );

        case 'stats-list':
          return (
            <div key={index} className="space-y-3 mt-4">
              {statsConfig.stats.map((stat) => (
                <div
                  key={stat.id}
                  className="bg-[#0D1B2A] rounded-lg p-3 border border-[#415A77]/30"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{stat.icon}</span>
                    <span className="font-medium text-[#E0E1DD]">{stat.name}</span>
                  </div>
                  <p className="text-sm text-[#778DA9] mb-2">{stat.description}</p>
                  <div className="text-xs text-[#415A77] font-mono">{stat.formula}</div>
                </div>
              ))}
            </div>
          );

        case 'roles-list':
          return (
            <div key={index} className="space-y-3 mt-4">
              {rolesData.map((role) => (
                <div
                  key={role.id}
                  className="bg-[#0D1B2A] rounded-lg p-3 border border-[#415A77]/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#E0E1DD]">{role.name}</span>
                    <span className="text-xs text-[#778DA9] bg-[#1B263B] px-2 py-0.5 rounded">
                      {ZONE_NAMES[role.zone] || role.zone}
                    </span>
                  </div>
                  <p className="text-xs text-[#D4A017] mb-1">{role.archetype}</p>
                  <p className="text-sm text-[#778DA9]">{role.publicMission}</p>
                </div>
              ))}
            </div>
          );

        case 'xp-table':
          return (
            <div key={index} className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#415A77]/30">
                    <th className="text-left py-2 text-[#778DA9] font-medium">Действие</th>
                    <th className="text-right py-2 text-[#778DA9] font-medium">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {block.items.map((item, i) => (
                    <tr key={i} className="border-b border-[#415A77]/20">
                      <td className="py-2">
                        <span className="text-[#E0E1DD]">{item.action}</span>
                        <span className="block text-xs text-[#778DA9]">{item.note}</span>
                      </td>
                      <td className="py-2 text-right text-[#D4A017] font-medium">
                        {item.xp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        default:
          return null;
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#1B263B] rounded-xl p-5">
        <h1 className="text-xl font-bold text-[#E0E1DD]">Правила игры</h1>
        <p className="text-sm text-[#778DA9] mt-1">
          Справочник по игре «Проект Горизонт»
        </p>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-2">
        {(rulesContent.sections as RuleSection[]).map((section) => (
          <div
            key={section.id}
            className="bg-[#1B263B] rounded-xl overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1B263B]/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                <span className="font-medium text-[#E0E1DD]">{section.title}</span>
              </div>
              <span
                className={`text-[#778DA9] transition-transform ${
                  expandedSection === section.id ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {/* Section Content */}
            {expandedSection === section.id && (
              <div className="px-4 pb-4 border-t border-[#415A77]/30">
                <div className="pt-4">
                  {renderContent(section.content)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <div className="bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl p-4">
        <h3 className="font-medium text-[#D4A017] mb-2">Советы</h3>
        <ul className="space-y-2 text-sm text-[#778DA9]">
          <li>• Распределяйте очки характеристик в соответствии с вашей ролью</li>
          <li>• Сотрудничайте с командой — это командная игра</li>
          <li>• Выполняйте обещания для получения бонусов</li>
          <li>• Следите за событиями — они могут изменить ход игры</li>
        </ul>
      </div>
    </div>
  );
}
