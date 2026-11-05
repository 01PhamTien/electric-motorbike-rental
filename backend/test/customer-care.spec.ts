import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { Role } from '../src/common/enums/role.enum';
import { CustomerCareService } from '../src/modules/customer-care/customer-care.service';
import { BookingIssueStatus, BookingIssueType, BookingIssueSeverity } from '../src/modules/customer-care/booking-issue.entity';

function fixture(status: BookingStatus = BookingStatus.COMPLETED) {
  const booking = { id: 12, customerId: 5, vehicleId: 9, status, vehicle: { stationId: 3 } };
  const reviewRows: any[] = [];
  const issueRows: any[] = [];
  const ds = { getRepository: () => ({ findOne: async () => booking, findOneBy: async () => booking }) };
  const reviews = {
    exist: async ({where}:{where:{bookingId:number}}) => reviewRows.some(x=>x.bookingId===where.bookingId),
    find: async () => reviewRows,
    findOne: async ({where}:{where:{bookingId:number}}) => reviewRows.find(x=>x.bookingId===where.bookingId) ?? null,
    create: (x:any) => x,
    save: async (x:any) => {const row={id:reviewRows.length+1,...x,createdAt:new Date()};reviewRows.push(row);return row;},
  };
  const issues = {
    find: async () => issueRows,
    findOne: async ({where}:{where:{id:number}}) => issueRows.find(x=>x.id===where.id) ?? null,
    create: (x:any) => x,
    save: async (x:any) => {if(!x.id){x.id=issueRows.length+1;x.createdAt=new Date();}issueRows.push(x);return x;},
  };
  return { service:new CustomerCareService(ds as never,reviews as never,issues as never),booking,reviewRows,issueRows };
}

test('only owner can review a completed booking and each booking is reviewed once', async () => {
  const {service,reviewRows}=fixture();
  const user={sub:5,email:'customer@test.invalid',role:Role.CUSTOMER,stationId:null};
  const review=await service.createReview(user,12,{rating:5,comment:'Xe chạy ổn định'} as never);
  assert.equal(review.rating,5);
  assert.equal(reviewRows.length,1);
  await assert.rejects(()=>service.createReview(user,12,{rating:4} as never),/đã được đánh giá/);
  await assert.rejects(()=>service.createReview({...user,sub:6},12,{rating:5} as never),/Forbidden/);
});

test('review is blocked until the vehicle is returned and booking is completed', async () => {
  const {service}=fixture(BookingStatus.RENTING);
  await assert.rejects(()=>service.createReview({sub:5,email:'customer@test.invalid',role:Role.CUSTOMER,stationId:null},12,{rating:5} as never),/sau khi đã hoàn tất/);
});

test('customer can report low battery only on their active rental and may attach a complete GPS pair', async () => {
  const {service,issueRows}=fixture(BookingStatus.RENTING);
  const user={sub:5,email:'customer@test.invalid',role:Role.CUSTOMER,stationId:null};
  const issue=await service.createIssue(user,12,{issueType:BookingIssueType.LOW_BATTERY,severity:BookingIssueSeverity.HIGH,description:'Pin còn 5%, xe cần hỗ trợ',latitude:16.05,longitude:108.2});
  assert.equal(issue.status,BookingIssueStatus.OPEN);
  assert.equal(issueRows.length,1);
  await assert.rejects(()=>service.createIssue(user,12,{issueType:BookingIssueType.BREAKDOWN,severity:BookingIssueSeverity.MEDIUM,description:'Xe chết máy giữa đường',latitude:16.05} as never),/đủ cả vĩ độ và kinh độ/);
  await assert.rejects(()=>service.createIssue({...user,sub:6},12,{issueType:BookingIssueType.OTHER,severity:BookingIssueSeverity.LOW,description:'Không thể tiếp tục hành trình'} as never),/Forbidden/);
});

test('staff must provide a resolution note and may only update issues at their station', async () => {
  const {service,issueRows}=fixture(BookingStatus.RENTING);
  issueRows.push({id:2,vehicle:{stationId:3},status:BookingIssueStatus.OPEN,resolutionNote:null});
  const staff={sub:8,email:'staff@test.invalid',role:Role.STAFF,stationId:3};
  await assert.rejects(()=>service.updateIssue(staff,2,{status:BookingIssueStatus.RESOLVED} as never),/ghi chú cách xử lý/);
  const updated=await service.updateIssue(staff,2,{status:BookingIssueStatus.RESOLVED,resolutionNote:'Đã điều phối xe cứu hộ'} as never);
  assert.equal(updated.status,BookingIssueStatus.RESOLVED);
  await assert.rejects(()=>service.updateIssue({...staff,stationId:4},2,{status:BookingIssueStatus.IN_PROGRESS} as never),/Forbidden/);
});
