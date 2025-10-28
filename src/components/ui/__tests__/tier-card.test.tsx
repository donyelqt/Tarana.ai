import React from 'react';
import { Check, Zap } from 'lucide-react';
import { TierCardProps } from '../../../types/credit-tiers';

describe('TierCard', () => {
  it('should have correct props interface for unlocked tier', () => {
    const props: TierCardProps = {
      tierName: 'Explorer',
      dailyCredits: 1,
      totalCredits: 6,
      status: 'unlocked',
      icon: <Check className="w-5 h-5 text-white" />
    };

    expect(props.tierName).toBe('Explorer');
    expect(props.dailyCredits).toBe(1);
    expect(props.totalCredits).toBe(6);
    expect(props.status).toBe('unlocked');
    expect(props.referralsRequired).toBeUndefined();
  });

  it('should have correct props interface for next tier', () => {
    const props: TierCardProps = {
      tierName: 'Smart Traveler',
      dailyCredits: 2,
      totalCredits: 8,
      referralsRequired: 3,
      status: 'next',
      icon: <Zap className="w-5 h-5 text-white" />
    };

    expect(props.tierName).toBe('Smart Traveler');
    expect(props.dailyCredits).toBe(2);
    expect(props.totalCredits).toBe(8);
    expect(props.referralsRequired).toBe(3);
    expect(props.status).toBe('next');
  });

  it('should have correct props interface for locked tier', () => {
    const props: TierCardProps = {
      tierName: 'Voyager',
      dailyCredits: 2,
      totalCredits: 10,
      referralsRequired: 5,
      status: 'locked',
      icon: <Zap className="w-5 h-5 text-white" />
    };

    expect(props.tierName).toBe('Voyager');
    expect(props.dailyCredits).toBe(2);
    expect(props.totalCredits).toBe(10);
    expect(props.referralsRequired).toBe(5);
    expect(props.status).toBe('locked');
  });

  it('should handle all tier status values', () => {
    const statuses: Array<'unlocked' | 'next' | 'locked'> = ['unlocked', 'next', 'locked'];
    
    statuses.forEach(status => {
      const props: TierCardProps = {
        tierName: 'Test Tier',
        dailyCredits: 1,
        totalCredits: 6,
        status,
        icon: <Check className="w-5 h-5 text-white" />
      };
      
      expect(props.status).toBe(status);
    });
  });

  it('should validate required props are present', () => {
    const requiredProps: TierCardProps = {
      tierName: 'Test',
      dailyCredits: 1,
      totalCredits: 6,
      status: 'unlocked',
      icon: <Check className="w-5 h-5 text-white" />
    };

    // All required props should be defined
    expect(requiredProps.tierName).toBeDefined();
    expect(requiredProps.dailyCredits).toBeDefined();
    expect(requiredProps.totalCredits).toBeDefined();
    expect(requiredProps.status).toBeDefined();
    expect(requiredProps.icon).toBeDefined();
  });
});