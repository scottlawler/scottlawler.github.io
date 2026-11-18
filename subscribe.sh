#!/bin/bash
A=897660681468
N=Monthly-50-Dollar-Alert
E=scott.lawler@LP3.com

aws budgets create-subscriber --account-id $A --budget-name "$N" \
  --notification '{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"}' \
  --subscriber "{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$E\"}" \
  --region us-east-1 && echo "ACTUAL OK"

aws budgets create-subscriber --account-id $A --budget-name "$N" \
  --notification '{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"}' \
  --subscriber "{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$E\"}" \
  --region us-east-1 && echo "FORECAST OK"

aws budgets describe-subscribers-for-notification --account-id $A --budget-name "$N" \
  --notification '{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"}' \
  --region us-east-1 --query 'Subscribers[*].Address' --output text > /tmp/subs.txt
aws s3 cp /tmp/subs.txt s3://findata-lp3-app/_subs.txt --content-type text/plain
echo ALL_DONE
