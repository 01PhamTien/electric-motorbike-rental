import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BookingIssueSeverity, BookingIssueStatus, BookingIssueType } from './booking-issue.entity';

export class CreateVehicleReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(1200) comment?: string;
}
export class CreateBookingIssueDto {
  @IsEnum(BookingIssueType) issueType: BookingIssueType;
  @IsEnum(BookingIssueSeverity) severity: BookingIssueSeverity;
  @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
export class UpdateBookingIssueDto {
  @IsEnum(BookingIssueStatus) status: BookingIssueStatus;
  @IsOptional() @IsString() @MaxLength(1000) resolutionNote?: string;
}
