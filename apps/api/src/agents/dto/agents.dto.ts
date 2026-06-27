import { ApiProperty } from '@nestjs/swagger';
import { AgentPresence, Permission, TeamRole } from '@watsapp/database';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({ enum: TeamRole, required: false })
  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;

  @ApiProperty({ enum: Permission, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

export class UpdateAgentStatusDto {
  @ApiProperty({ enum: AgentPresence })
  @IsEnum(AgentPresence)
  presence!: AgentPresence;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
