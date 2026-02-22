'use client';

import { useSpaces } from './useSpaces.query';
import { useBoards } from './useBoards.query';

export type SubmissionTemplateType = 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';

export function useSubmissionTarget(templateType: SubmissionTemplateType) {
  const { data: spacesData, isLoading: spacesLoading } = useSpaces();

  const space = spacesData?.spaces?.find((s) => s.templateType === templateType);

  const { data: boardsData, isLoading: boardsLoading } = useBoards(space?.id);
  const board = boardsData?.boards?.[0];
  const column = board?.columns?.[0];

  return {
    spaceId: space?.id,
    boardId: board?.id,
    columnId: column?.id,
    isLoading: spacesLoading || (!!space?.id && boardsLoading),
    hasTarget: !!(space?.id && board?.id && column?.id),
    // True when spaces finished loading but no matching space found
    spaceMissing: !spacesLoading && !!spacesData && !space,
  };
}
